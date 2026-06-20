#!/usr/bin/env python3
import json
import math
import struct
import sys
from collections import Counter
from pathlib import Path

import numpy as np


def box_mesh(origin, size):
    x, y, z = origin
    lx, ly, lz = size
    vertices = np.array([
        [x, y, z], [x + lx, y, z], [x + lx, y + ly, z], [x, y + ly, z],
        [x, y, z + lz], [x + lx, y, z + lz], [x + lx, y + ly, z + lz], [x, y + ly, z + lz],
    ], dtype=float)
    faces = np.array([
        [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
        [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
        [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
    ], dtype=int)
    return vertices, faces


def triangular_prism(origin, length, width, height, mirror=False):
    x, y, z = origin
    if mirror:
        cross = [(y, z), (y + width, z), (y + width, z + height)]
    else:
        cross = [(y, z), (y + width, z), (y, z + height)]
    vertices = np.array(
        [[x, cy, cz] for cy, cz in cross] + [[x + length, cy, cz] for cy, cz in cross],
        dtype=float,
    )
    faces = np.array([
        [0, 2, 1], [3, 4, 5],
        [0, 1, 4], [0, 4, 3],
        [1, 2, 5], [1, 5, 4],
        [2, 0, 3], [2, 3, 5],
    ], dtype=int)
    return vertices, faces


def combine(parts):
    vertices = []
    faces = []
    offset = 0
    for part_vertices, part_faces in parts:
        vertices.extend(part_vertices.tolist())
        faces.extend((part_faces + offset).tolist())
        offset += len(part_vertices)
    return np.array(vertices, dtype=float), np.array(faces, dtype=int)


def edge_manifold(vertices, faces):
    edges = Counter()
    for face in faces:
        for a, b in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0])):
            edges[tuple(sorted((int(a), int(b))))] += 1
    return bool(edges) and all(count == 2 for count in edges.values())


def normal(a, b, c):
    value = np.cross(b - a, c - a)
    length = np.linalg.norm(value)
    return value / length if length else np.array([0.0, 0.0, 0.0])


def write_binary_stl(path, vertices, faces, name):
    with open(path, "wb") as handle:
        handle.write(name.encode("ascii", "ignore")[:80].ljust(80, b"\0"))
        handle.write(struct.pack("<I", len(faces)))
        for face in faces:
            a, b, c = vertices[face]
            n = normal(a, b, c)
            handle.write(struct.pack("<12fH", *(n.tolist() + a.tolist() + b.tolist() + c.tolist()), 0))


def design_nest(dimensions):
    overall_l = dimensions["overall_length"]["nominal_mm"]
    overall_w = dimensions["overall_width"]["nominal_mm"]
    overall_h = dimensions["overall_height"]["nominal_mm"]
    pocket_l = dimensions["pocket_length"]["nominal_mm"]
    pocket_w = dimensions["pocket_width"]["nominal_mm"]
    pocket_d = dimensions["pocket_depth"]["nominal_mm"]
    wall_x = (overall_l - pocket_l) / 2
    wall_y = (overall_w - pocket_w) / 2
    floor = max(3.0, overall_h - pocket_d)
    return combine([
        box_mesh((0, 0, 0), (overall_l, overall_w, floor)),
        box_mesh((0, 0, floor), (wall_x, overall_w, pocket_d)),
        box_mesh((overall_l - wall_x, 0, floor), (wall_x, overall_w, pocket_d)),
        box_mesh((wall_x, 0, floor), (pocket_l, wall_y, pocket_d)),
        box_mesh((wall_x, overall_w - wall_y, floor), (pocket_l, wall_y, pocket_d)),
    ])


def design_vblock(dimensions):
    length = dimensions["overall_length"]["nominal_mm"]
    width = dimensions["overall_width"]["nominal_mm"]
    height = dimensions["overall_height"]["nominal_mm"]
    base_h = max(4.0, height * 0.22)
    half = width / 2
    return combine([
        box_mesh((0, 0, 0), (length, width, base_h)),
        triangular_prism((0, 0, base_h), length, half, height - base_h, mirror=False),
        triangular_prism((0, half, base_h), length, half, height - base_h, mirror=True),
    ])


def main(input_path, output_path, report_path):
    payload = json.loads(Path(input_path).read_text(encoding="utf-8"))
    fixture_type = payload["fixture_type"]
    dimensions = payload["specification"]["dimensions"]
    if fixture_type == "NEST":
        vertices, faces = design_nest(dimensions)
    elif fixture_type == "V-BLOCK":
        vertices, faces = design_vblock(dimensions)
    else:
        raise ValueError("STL generation is limited to NEST and V-BLOCK fixtures")
    manifold = edge_manifold(vertices, faces)
    if manifold:
        write_binary_stl(output_path, vertices, faces, f"Aurevix {fixture_type} fixture")
    Path(report_path).write_text(json.dumps({
        "manifold": manifold,
        "triangles": int(len(faces)),
        "vertices": int(len(vertices)),
        "file_written": manifold,
    }), encoding="utf-8")
    if not manifold:
        raise SystemExit(2)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("usage: generate-fixture-stl.py INPUT.json OUTPUT.stl REPORT.json")
    main(sys.argv[1], sys.argv[2], sys.argv[3])
