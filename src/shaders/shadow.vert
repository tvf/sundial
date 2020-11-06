#version 300 es

precision highp float;

in vec3 world_position;
in vec3 primary_normal;
in vec3 secondary_normal;

uniform mat4 model_to_world;
uniform mat4 world_to_clip;
uniform vec3 to_sun;
uniform float shadow_length;

void main(void) {

    // pass a model-to-world transform
    vec3 world_primary_normal = vec3(model_to_world * vec4(primary_normal, 0.f));
    vec3 world_secondary_normal = vec3(model_to_world * vec4(secondary_normal, 0.f));

    bool primary_faces_sun = dot(world_primary_normal, to_sun) >= 0.f;
    bool secondary_faces_sun = dot(world_secondary_normal, to_sun) >= 0.f;

    if (primary_faces_sun == secondary_faces_sun) {
        gl_Position = vec4(0.f, 0.f, -1000.f, 1.f);
    } else {

        if (primary_faces_sun) {
            gl_Position = vec4(world_to_clip * model_to_world * vec4(world_position, 1.f));
        } else {
            // point at infinity - needs depth clamping
            // gl_Position = vec4(world_to_clip * vec4(-to_sun, 0.f));

            vec3 transformed_position = vec3(model_to_world * vec4(world_position, 1.f));
            vec4 translated_position
                = vec4(transformed_position - shadow_length * to_sun, 1.f);
            gl_Position = vec4(world_to_clip * translated_position);
        }
    }
}
