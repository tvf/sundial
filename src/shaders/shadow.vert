#version 300 es

precision highp float;

in vec3 world_position;
in vec3 primary_normal;
in vec3 secondary_normal;

out vec3 frag_world_position;

uniform mat4 world_to_clip;
uniform vec3 to_sun;
uniform float shadow_length;

void main(void) {

    bool primary_faces_sun = dot(primary_normal, to_sun) >= 0.f;
    bool secondary_faces_sun = dot(secondary_normal, to_sun) >= 0.f;

    if (primary_faces_sun == secondary_faces_sun) {
        gl_Position = vec4(0.f, 0.f, -1000.f, 1.f);
    } else {

        if (primary_faces_sun) {
            gl_Position = vec4(world_to_clip * vec4(world_position, 1.f));
            frag_world_position = world_position;
        } else {
            // point at infinity - needs depth clamping
            // gl_Position = vec4(world_to_clip * vec4(-to_sun, 0.f));
            vec4 translated_position
                = vec4(world_position - shadow_length * to_sun, 1.f);
            frag_world_position = vec3(translated_position);
            gl_Position = vec4(world_to_clip * translated_position);
        }
    }
}
