#version 300 es

precision highp float;

in vec3 world_position;
in vec3 primary_normal;
in vec3 secondary_normal;

uniform mat4 world_to_clip;
uniform vec3 to_sun;

void main(void) {

    bool primary_faces_sun = dot(primary_normal, to_sun) >= 0.f;
    bool secondary_faces_sun = dot(secondary_normal, to_sun) >= 0.f;

    if (primary_faces_sun == secondary_faces_sun) {
        gl_Position = vec4(0.f, 0.f, -1000.f, 1.f);
    } else {
        if (primary_faces_sun) {
            gl_Position = vec4(world_to_clip * vec4(world_position, 1.f));
        } else {
            // point at infinity
            gl_Position = vec4(world_to_clip * vec4(-to_sun, 0.f));
        }
    }
}
