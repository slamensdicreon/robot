"""Generate STL for translucent LED ring mouth casing.

Run: python3 mouth_case.py
Output: mouth_case.stl (ASCII STL, ready for Bambu Studio)

Print in translucent PETG or clear PLA for best light diffusion.
"""
import math
import os

# ============================================================
# PARAMETERS — adjust these to match your ring
# ============================================================
RING_OD = 45.0          # LED ring outer diameter (mm) — measure yours!
RING_ID = 32.0          # LED ring inner diameter (mm)
RING_THICK = 2.0        # LED ring PCB thickness (mm)
WIRE_DEPTH = 4.0        # Extra depth below ring for wires/solder joints

CASE_WALL = 2.0         # Outer wall thickness (mm)
CASE_CLEARANCE = 0.6    # Gap around ring for fit tolerance
DIFFUSER_THICK = 1.0    # Top wall thickness — thin = more light
LEDGE_WIDTH = 2.0       # Inner shelf that supports the ring
LEDGE_THICK = 1.2       # Shelf thickness

CLIP_WIDTH = 6.0        # Back clip tab width
CLIP_THICK = 1.5        # Back clip thickness
CLIP_OVERHANG = 2.0     # How far clip tabs extend inward
CLIP_COUNT = 4          # Number of clips (evenly spaced)

SEGMENTS = 64           # Circle smoothness (64 = good for printing)

# ============================================================
# DERIVED DIMENSIONS
# ============================================================
cavity_r = RING_OD / 2 + CASE_CLEARANCE
outer_r = cavity_r + CASE_WALL
inner_hole_r = RING_ID / 2 - CASE_CLEARANCE
ledge_r = RING_ID / 2 + LEDGE_WIDTH
total_depth = RING_THICK + WIRE_DEPTH + LEDGE_THICK
total_height = total_depth + DIFFUSER_THICK

# Z layout (bottom = 0, top = total_height):
#   0                  -> back opening
#   LEDGE_THICK        -> top of ledge shelf (ring sits here)
#   LEDGE_THICK + RING_THICK + WIRE_DEPTH -> top of cavity
#   total_height       -> top of diffuser cap

z_back = 0.0
z_ledge_top = LEDGE_THICK
z_cavity_top = total_depth
z_top = total_height


# ============================================================
# STL GEOMETRY HELPERS
# ============================================================
triangles = []


def tri(v0, v1, v2):
    """Add a triangle (vertices as (x,y,z) tuples). Normal auto-calculated."""
    # Cross product for face normal
    ax, ay, az = v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]
    bx, by, bz = v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]
    nx = ay * bz - az * by
    ny = az * bx - ax * bz
    nz = ax * by - ay * bx
    length = math.sqrt(nx * nx + ny * ny + nz * nz)
    if length > 0:
        nx /= length
        ny /= length
        nz /= length
    triangles.append(((nx, ny, nz), v0, v1, v2))


def quad(v0, v1, v2, v3):
    """Two triangles forming a quad (v0-v1-v2-v3 in order)."""
    tri(v0, v1, v2)
    tri(v0, v2, v3)


def circle_pt(r, seg, z):
    """Point on a circle of radius r at segment index seg, height z."""
    angle = 2 * math.pi * seg / SEGMENTS
    return (r * math.cos(angle), r * math.sin(angle), z)


def ring_strip(r_outer, r_inner, z, flip=False):
    """Flat annular ring at height z between two radii."""
    for s in range(SEGMENTS):
        s1 = (s + 1) % SEGMENTS
        o0 = circle_pt(r_outer, s, z)
        o1 = circle_pt(r_outer, s1, z)
        i0 = circle_pt(r_inner, s, z)
        i1 = circle_pt(r_inner, s1, z)
        if flip:
            quad(o0, i0, i1, o1)
        else:
            quad(o0, o1, i1, i0)


def cylinder_wall(r, z_bot, z_top, outward=True):
    """Vertical cylinder surface."""
    for s in range(SEGMENTS):
        s1 = (s + 1) % SEGMENTS
        b0 = circle_pt(r, s, z_bot)
        b1 = circle_pt(r, s1, z_bot)
        t0 = circle_pt(r, s, z_top)
        t1 = circle_pt(r, s1, z_top)
        if outward:
            quad(b0, b1, t1, t0)
        else:
            quad(b0, t0, t1, b1)


def disc(r, z, up=True):
    """Solid filled circle at height z."""
    center = (0, 0, z)
    for s in range(SEGMENTS):
        s1 = (s + 1) % SEGMENTS
        p0 = circle_pt(r, s, z)
        p1 = circle_pt(r, s1, z)
        if up:
            tri(center, p0, p1)
        else:
            tri(center, p1, p0)


def box(x0, y0, z0, x1, y1, z1):
    """Axis-aligned box from (x0,y0,z0) to (x1,y1,z1)."""
    # 6 faces, 12 triangles
    v = [
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),  # bottom
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1),  # top
    ]
    # Bottom (normal -Z)
    quad(v[0], v[3], v[2], v[1])
    # Top (normal +Z)
    quad(v[4], v[5], v[6], v[7])
    # Front (normal -Y)
    quad(v[0], v[1], v[5], v[4])
    # Back (normal +Y)
    quad(v[3], v[7], v[6], v[2])
    # Left (normal -X)
    quad(v[0], v[4], v[7], v[3])
    # Right (normal +X)
    quad(v[1], v[2], v[6], v[5])


# ============================================================
# BUILD THE CASE
# ============================================================

# --- Outer wall: full height ---
cylinder_wall(outer_r, z_back, z_top, outward=True)

# --- Inner cavity wall: from back opening up to diffuser ---
cylinder_wall(cavity_r, z_back, z_cavity_top, outward=False)

# --- Top: diffuser cap (annular ring: outer_r to inner_hole_r) ---
ring_strip(outer_r, inner_hole_r, z_top, flip=False)

# --- Underside of diffuser at cavity top (annular: cavity_r to inner_hole_r) ---
ring_strip(cavity_r, inner_hole_r, z_cavity_top, flip=True)

# --- Diffuser inner wall between cavity_r and outer_r at top ---
# Connect the diffuser top ring to the cavity top ring on the outer edge
# This is already handled by the outer wall going to z_top and inner wall to z_cavity_top
# We need a horizontal ring connecting outer wall to inner wall at z_cavity_top
ring_strip(outer_r, cavity_r, z_cavity_top, flip=True)

# --- Inner hole wall (center opening through diffuser) ---
cylinder_wall(inner_hole_r, z_cavity_top, z_top, outward=False)

# --- Ledge shelf: ring from ledge_r to cavity_r at z_ledge_top ---
ring_strip(cavity_r, ledge_r, z_ledge_top, flip=False)

# --- Ledge inner wall: from back to ledge top ---
cylinder_wall(ledge_r, z_back, z_ledge_top, outward=False)

# --- Ledge underside: connect at z_back from cavity_r to ledge_r ---
# (the back opening is the full cavity_r, ledge wall starts at back)
# Back face: annular ring at z_back between outer_r and cavity_r (case floor rim)
ring_strip(outer_r, cavity_r, z_back, flip=True)

# --- Back opening: annular ring at z_back from ledge_r inward ---
# The back is open from 0 to ledge_r (the ring drops in from the back)
# But we need the ledge bottom surface from cavity_r to ledge_r at z_back
ring_strip(cavity_r, ledge_r, z_back, flip=True)

# --- Center hole at back (open, but we need the inner wall to go down) ---
# Inner hole only exists in the diffuser zone (z_cavity_top to z_top)
# Below that, the center is open (ring sits on ledge)

# --- Back clips: cross-shaped tabs ---
for c in range(CLIP_COUNT):
    angle = 2 * math.pi * c / CLIP_COUNT
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)

    # Clip sits at the back face, extends inward from cavity wall
    # Center of clip at cavity_r - CLIP_OVERHANG/2
    clip_inner_r = cavity_r - CLIP_OVERHANG
    clip_outer_r = cavity_r

    # Clip is a small rectangular tab
    half_w = CLIP_WIDTH / 2

    # Rotated corners of the clip rectangle
    # Direction along the wall (tangent)
    tx, ty = -sin_a, cos_a

    # Four corners at z_back
    cx_inner = clip_inner_r * cos_a
    cy_inner = clip_inner_r * sin_a
    cx_outer = clip_outer_r * cos_a
    cy_outer = clip_outer_r * sin_a

    p0 = (cx_inner - half_w * tx, cy_inner - half_w * ty, z_back)
    p1 = (cx_inner + half_w * tx, cy_inner + half_w * ty, z_back)
    p2 = (cx_outer + half_w * tx, cy_outer + half_w * ty, z_back)
    p3 = (cx_outer - half_w * tx, cy_outer - half_w * ty, z_back)

    p4 = (cx_inner - half_w * tx, cy_inner - half_w * ty, z_back + CLIP_THICK)
    p5 = (cx_inner + half_w * tx, cy_inner + half_w * ty, z_back + CLIP_THICK)
    p6 = (cx_outer + half_w * tx, cy_outer + half_w * ty, z_back + CLIP_THICK)
    p7 = (cx_outer - half_w * tx, cy_outer - half_w * ty, z_back + CLIP_THICK)

    # Bottom face (normal -Z)
    quad(p0, p3, p2, p1)
    # Top face (normal +Z)
    quad(p4, p5, p6, p7)
    # Side faces
    quad(p0, p1, p5, p4)
    quad(p1, p2, p6, p5)
    quad(p2, p3, p7, p6)
    quad(p3, p0, p4, p7)


# ============================================================
# WRITE ASCII STL
# ============================================================
out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mouth_case.stl")

with open(out_path, "w") as f:
    f.write("solid mouth_case\n")
    for normal, v0, v1, v2 in triangles:
        f.write("  facet normal {:.6f} {:.6f} {:.6f}\n".format(*normal))
        f.write("    outer loop\n")
        f.write("      vertex {:.4f} {:.4f} {:.4f}\n".format(*v0))
        f.write("      vertex {:.4f} {:.4f} {:.4f}\n".format(*v1))
        f.write("      vertex {:.4f} {:.4f} {:.4f}\n".format(*v2))
        f.write("    endloop\n")
        f.write("  endfacet\n")
    f.write("endsolid mouth_case\n")

print("Wrote {} triangles to {}".format(len(triangles), out_path))
print()
print("Dimensions:")
print("  Outer diameter: {:.1f}mm".format(outer_r * 2))
print("  Cavity diameter: {:.1f}mm".format(cavity_r * 2))
print("  Center hole: {:.1f}mm".format(inner_hole_r * 2))
print("  Total height: {:.1f}mm".format(total_height))
print("  Diffuser thickness: {:.1f}mm".format(DIFFUSER_THICK))
print()
print("Cross-section (side view):")
print()
print("  top (diffuser)  ┌─────────────────────┐ z={:.1f}".format(z_top))
print("                  │▓▓▓▓▓ diffuser ▓▓▓▓▓▓│ ({:.1f}mm translucent)".format(DIFFUSER_THICK))
print("  cavity top      ├─────┐         ┌─────┤ z={:.1f}".format(z_cavity_top))
print("                  │     │  (LEDs)  │     │")
print("                  │     │  cavity  │     │")
print("  ledge           │     ├─────────┤     │ z={:.1f}".format(z_ledge_top))
print("                  │     │ ░ring░  │     │")
print("  back (open)     └─clip─┘         └─clip─┘ z={:.1f}".format(z_back))
print()
print("Print tips:")
print("  - Use translucent PETG or clear PLA")
print("  - 0.2mm layer height for good diffusion")
print("  - Print diffuser-side DOWN (top face on bed) for smooth finish")
print("  - 2-3 perimeters, 15% infill")
