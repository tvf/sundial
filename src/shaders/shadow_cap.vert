#version 300 es

precision highp float;

in vec3 world_position;
in vec3 normal;

uniform mat4 model_to_world;
uniform mat4 world_to_clip;
uniform vec3 to_sun;

out float depth_z;
out float depth_w;

void main(void) {

    vec3 world_normal = vec3(model_to_world * vec4(normal, 0.f));

    bool faces_sun = dot(world_normal, to_sun) >= 0.f;

    if (faces_sun) {
        gl_Position = vec4(0.f, 0.f, -1000.f, 1.f);
    } else {
        gl_Position = vec4(world_to_clip * model_to_world * vec4(world_position, 1.f));
    }

    depth_z = gl_Position.z;
    depth_w = gl_Position.w;
}
