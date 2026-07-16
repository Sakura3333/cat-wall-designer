import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


COMPILER_VERSION = "0.1.0"
MM_TO_M = 0.001
HARD_TOLERANCE_MM = 1.0


def parse_args():
    forwarded = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True)
    parser.add_argument("--plan", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(forwarded)


def read_json(path):
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def configure_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    scene.unit_settings.scale_length = 1.0
    scene.world = bpy.data.worlds.new("World")


def build_box(node):
    size = node["sizeMm"]
    transform = node["transform"]
    position = transform["positionMm"]
    rotation = transform["rotationDeg"]

    bpy.ops.mesh.primitive_cube_add(size=1.0)
    obj = bpy.context.object
    obj.name = node["id"]
    obj.dimensions = tuple(size[axis] * MM_TO_M for axis in ("x", "y", "z"))
    obj.location = tuple(position[axis] * MM_TO_M for axis in ("x", "y", "z"))
    obj.rotation_euler = tuple(math.radians(rotation[axis]) for axis in ("x", "y", "z"))
    obj["partId"] = node["partId"]
    obj["materialRole"] = node.get("materialRole", "default")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, node.get("materialRole", "default"))
    return obj


def assign_material(obj, material_role):
    material = bpy.data.materials.get(material_role) or bpy.data.materials.new(material_role)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = (0.34, 0.12, 0.035, 1.0)
        principled.inputs["Roughness"].default_value = 0.62
    material.diffuse_color = (0.34, 0.12, 0.035, 1.0)
    obj.data.materials.append(material)


def apply_mounting_hole(node, target):
    axis = node["axis"]
    center = node["centerMm"]
    radius_m = node["diameterMm"] * MM_TO_M / 2
    target_depth_m = target_depth_along_axis(target, axis)
    cutter_depth_m = target_depth_m + 0.02

    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=radius_m, depth=cutter_depth_m)
    cutter = bpy.context.object
    cutter.name = f"{node['id']}-cutter"
    cutter.location = tuple(center[coordinate] * MM_TO_M for coordinate in ("x", "y", "z"))
    cutter.rotation_euler = cutter_rotation(axis)

    modifier = target.modifiers.new(name=f"boolean-{node['id']}", type="BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = cutter
    bpy.context.view_layer.objects.active = target
    target.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)

    actual = measure_hole_ring(target, center, axis, node["diameterMm"])
    bpy.data.objects.remove(cutter, do_unlink=True)
    return actual


def target_depth_along_axis(target, axis):
    dimensions = target.dimensions
    if axis.endswith("X"):
        return dimensions.x
    if axis.endswith("Y"):
        return dimensions.y
    return dimensions.z


def cutter_rotation(axis):
    if axis.endswith("X"):
        return (0, math.radians(90), 0)
    if axis.endswith("Y"):
        return (math.radians(90), 0, 0)
    return (0, 0, 0)


def measure_hole_ring(target, center_mm, axis, expected_diameter_mm):
    center = Vector(tuple(center_mm[key] * MM_TO_M for key in ("x", "y", "z")))
    expected_radius_m = expected_diameter_mm * MM_TO_M / 2
    radial_axes = radial_axis_indexes(axis)
    ring_points = []

    for vertex in target.data.vertices:
        point = target.matrix_world @ vertex.co
        radial = math.sqrt(sum((point[index] - center[index]) ** 2 for index in radial_axes))
        if abs(radial - expected_radius_m) <= 0.00025:
            ring_points.append(point)

    if len(ring_points) < 8:
        return {"found": False, "diameterMm": None, "centerMm": None, "vertexCount": len(ring_points)}

    estimated_center = Vector((0.0, 0.0, 0.0))
    for point in ring_points:
        estimated_center += point
    estimated_center /= len(ring_points)

    radii = [
        math.sqrt(sum((point[index] - estimated_center[index]) ** 2 for index in radial_axes))
        for point in ring_points
    ]
    diameter_mm = 2 * sum(radii) / len(radii) / MM_TO_M
    return {
        "found": True,
        "diameterMm": diameter_mm,
        "centerMm": {key: estimated_center[index] / MM_TO_M for index, key in enumerate(("x", "y", "z"))},
        "vertexCount": len(ring_points),
    }


def radial_axis_indexes(axis):
    if axis.endswith("X"):
        return (1, 2)
    if axis.endswith("Y"):
        return (0, 2)
    return (0, 1)


def world_bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return minimum, maximum


def center_objects(objects):
    minimum, maximum = world_bounds(objects)
    center = (minimum + maximum) / 2
    for obj in objects:
        obj.location -= center
    bpy.context.view_layer.update()
    return {key: center[index] / MM_TO_M for index, key in enumerate(("x", "y", "z"))}


def actual_size_mm(objects):
    minimum, maximum = world_bounds(objects)
    dimensions = maximum - minimum
    return {key: dimensions[index] / MM_TO_M for index, key in enumerate(("x", "y", "z"))}


def size_checks(expected, actual):
    checks = []
    for axis in ("x", "y", "z"):
        delta = abs(actual[axis] - expected[axis])
        checks.append(
            {
                "id": f"overall-size-{axis}",
                "kind": "overall-size",
                "status": "passed" if delta <= HARD_TOLERANCE_MM else "failed",
                "expectedMm": expected[axis],
                "actualMm": actual[axis],
                "deltaMm": delta,
                "message": f"整体尺寸 {axis.upper()} 轴误差 {delta:.6f} mm。",
            }
        )
    return checks


def hole_checks(node, actual):
    if not actual["found"]:
        return [
            {
                "id": f"{node['holeId']}-topology",
                "kind": "topology",
                "status": "failed",
                "message": f"无法从 Boolean 结果中确认施工孔 {node['holeId']}。",
            }
        ]

    diameter_delta = abs(actual["diameterMm"] - node["diameterMm"])
    expected_center = node["centerMm"]
    actual_center = actual["centerMm"]
    radial_axes = radial_axis_indexes(node["axis"])
    keys = ("x", "y", "z")
    center_delta = math.sqrt(sum((actual_center[keys[index]] - expected_center[keys[index]]) ** 2 for index in radial_axes))
    return [
        {
            "id": f"{node['holeId']}-diameter",
            "kind": "hole-diameter",
            "status": "passed" if diameter_delta <= HARD_TOLERANCE_MM else "failed",
            "expectedMm": node["diameterMm"],
            "actualMm": actual["diameterMm"],
            "deltaMm": diameter_delta,
            "message": f"施工孔 {node['holeId']} 孔径误差 {diameter_delta:.6f} mm。",
        },
        {
            "id": f"{node['holeId']}-center",
            "kind": "hole-center",
            "status": "passed" if center_delta <= HARD_TOLERANCE_MM else "failed",
            "expectedMm": 0,
            "actualMm": center_delta,
            "deltaMm": center_delta,
            "message": f"施工孔 {node['holeId']} 中心误差 {center_delta:.6f} mm。",
        },
    ]


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def artifact(kind, path):
    item = Path(path)
    return {
        "kind": kind,
        "fileName": item.name,
        "sha256": sha256_file(item),
        "sizeBytes": item.stat().st_size,
    }


def export_outputs(output_directory, objects):
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)

    glb_path = output_directory / "model.glb"
    blend_path = output_directory / "model.blend"
    bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format="GLB", use_selection=True, export_yup=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    return glb_path, blend_path


def render_thumbnail(output_directory, objects):
    minimum, maximum = world_bounds(objects)
    dimensions = maximum - minimum
    largest_extent = max(dimensions.x, dimensions.y, dimensions.z)

    camera_data = bpy.data.cameras.new("qa-camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = largest_extent * 1.45
    camera = bpy.data.objects.new("qa-camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = Vector((largest_extent * 1.35, largest_extent * 0.95, largest_extent * 1.5))
    camera.rotation_euler = (-camera.location).to_track_quat("-Z", "Y").to_euler()

    key_data = bpy.data.lights.new("qa-key", type="AREA")
    key_data.energy = 220
    key_data.shape = "DISK"
    key_data.size = largest_extent * 2
    key = bpy.data.objects.new("qa-key", key_data)
    bpy.context.collection.objects.link(key)
    key.location = Vector((largest_extent, largest_extent * 1.5, largest_extent * 2))

    fill_data = bpy.data.lights.new("qa-fill", type="AREA")
    fill_data.energy = 90
    fill_data.size = largest_extent * 2
    fill = bpy.data.objects.new("qa-fill", fill_data)
    bpy.context.collection.objects.link(fill)
    fill.location = Vector((-largest_extent, largest_extent * 0.5, largest_extent))

    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.035, 0.035, 0.035)
    scene.view_settings.look = "AgX - Medium High Contrast"
    thumbnail_path = output_directory / "thumbnail.png"
    scene.render.filepath = str(thumbnail_path)
    bpy.ops.render.render(write_still=True)
    return thumbnail_path


def main():
    args = parse_args()
    spec = read_json(args.spec)
    plan = read_json(args.plan)
    output_directory = Path(args.output)
    output_directory.mkdir(parents=True, exist_ok=True)
    configure_scene()

    objects = {}
    checks = []
    for node in plan["nodes"]:
        if node["op"] == "box":
            objects[node["id"]] = build_box(node)

    for node in plan["nodes"]:
        if node["op"] == "mounting-hole":
            actual = apply_mounting_hole(node, objects[node["targetNodeId"]])
            checks.extend(hole_checks(node, actual))

    visible_objects = list(objects.values())
    origin_offset_mm = center_objects(visible_objects)
    actual_size = actual_size_mm(visible_objects)
    checks.extend(size_checks(spec["overallSizeMm"], actual_size))
    checks.append(
        {
            "id": "visible-mesh",
            "kind": "topology",
            "status": "passed" if visible_objects else "failed",
            "message": f"生成 {len(visible_objects)} 个可见网格；原点偏移 {origin_offset_mm} mm。",
        }
    )

    glb_path, blend_path = export_outputs(output_directory, visible_objects)
    thumbnail_path = render_thumbnail(output_directory, visible_objects)
    checks.append(
        {
            "id": "glb-export",
            "kind": "gltf",
            "status": "passed" if glb_path.exists() and glb_path.stat().st_size > 0 else "failed",
            "message": f"GLB 输出大小 {glb_path.stat().st_size if glb_path.exists() else 0} bytes。",
        }
    )
    checks.append(
        {
            "id": "thumbnail-render",
            "kind": "render",
            "status": "passed" if thumbnail_path.exists() and thumbnail_path.stat().st_size > 0 else "failed",
            "message": f"缩略图输出大小 {thumbnail_path.stat().st_size if thumbnail_path.exists() else 0} bytes。",
        }
    )

    status = "failed" if any(check["status"] == "failed" for check in checks) else "passed"
    report = {
        "schemaVersion": 1,
        "jobId": "phase-zero-local-run",
        "componentSpecRevision": spec["revision"],
        "planHash": sha256_file(args.plan),
        "compilerVersion": COMPILER_VERSION,
        "blenderVersion": bpy.app.version_string,
        "status": status,
        "hardConstraintToleranceMm": HARD_TOLERANCE_MM,
        "checks": checks,
        "artifacts": [artifact("glb", glb_path), artifact("blend", blend_path), artifact("thumbnail", thumbnail_path)],
    }
    report_path = output_directory / "quality-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"PSD3_COMPILER_RESULT={status}")
    print(f"PSD3_QUALITY_REPORT={report_path}")
    if status != "passed":
        raise SystemExit(3)


if __name__ == "__main__":
    main()
