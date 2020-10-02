#version 300 es

precision highp float;

in vec3 world_position;

uniform mat4 world_to_clip;

void main(void) {
    gl_Position = vec4(world_to_clip * vec4(world_position, 1.f));
}
