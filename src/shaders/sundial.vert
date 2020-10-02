#version 300 es

precision highp float;

in vec3 world_position;

out vec3 frag_world_position;

uniform mat4 world_to_clip;

void main(void) {
    frag_world_position = world_position;
    gl_Position = vec4(world_to_clip * vec4(world_position, 1.f));
}
