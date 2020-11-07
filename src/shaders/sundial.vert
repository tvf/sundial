#version 300 es

precision highp float;

in vec3 world_position;

out vec3 frag_world_position;

uniform mat4 model_to_world;
uniform mat4 world_to_clip;

out float depth_z;
out float depth_w;

void main(void) {
    frag_world_position = world_position;
    gl_Position = vec4(world_to_clip * model_to_world * vec4(world_position, 1.f));

    depth_z = gl_Position.z;
    depth_w = gl_Position.w;
}
