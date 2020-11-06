#version 300 es

precision highp float;

uniform mat4 world_to_clip;
uniform mat4 clip_to_world;
uniform vec2 viewport;
uniform float brightness;

out vec4 color;

float ndc_z_for_fragcoord() {
    return (2.0 * gl_FragCoord.z - gl_DepthRange.near - gl_DepthRange.far) / (gl_DepthRange.far - gl_DepthRange.near);
}

vec4 world_pos_for_ndc_z(float z) {
    vec4 ndcPos;
    ndcPos.xy = (2.0 * gl_FragCoord.xy) / (viewport) - 1.;
    ndcPos.z = z;
    ndcPos.w = 1.0;

    vec4 clipPos = ndcPos / gl_FragCoord.w;
    vec4 world_position = clip_to_world * clipPos;
    world_position /= world_position.w;

    return world_position;
}

void main() {
    vec3 world_ray_begin = vec3(world_pos_for_ndc_z(-1.));
    vec3 world_ray_end = vec3(world_pos_for_ndc_z(1.));

    vec3 o = world_ray_begin;
    vec3 d = normalize(world_ray_end - world_ray_begin);

    float h = -10.f;

    if (abs(d.z) < 0.001) {
        discard;
    }

    float t = (h - o.z) / d.z;

    if (t > 0.f) {
        vec3 intersect = o + d * t;

        vec4 mixing_color = vec4(vec3(0.75f), 1.f);

        float stripe_width = 0.1f;
        if (abs(intersect.x) < stripe_width || abs(intersect.y) < stripe_width) {
            mixing_color.rgb = vec3(0.5f);
        }

        mixing_color.rgb *= brightness;
        color = mixing_color;

        vec4 clip_intersect = vec4(world_to_clip * vec4(intersect, 1.f));
        float intersect_depth = (clip_intersect.z / clip_intersect.w + 1.f) / 2.f;

        gl_FragDepth = intersect_depth;
    } else {
        discard;
    }
}