// actor.sc — gerakkan satu entity sepanjang waypoint (Carpet scarpet, MC 1.20.1)
// Load : /script load actor
// Call : /script in actor run follow('Hero',[[0,65,0],[4,65,0],[4,65,4]],0.06)
//        /script in actor run stop()
// Untuk aktor BBS pakai camera/actor milik BBS — app ini untuk entity biasa / fake player.

__config() -> {'scope' -> 'global', 'stay_loaded' -> true};

global_actor = null;
global_points = [];
global_idx = 0;
global_speed = 0.05;
global_active = false;

stop() -> (
    global_active = false;
    'stopped'
);

follow(name, points, speed) -> (
    found = entity_selector('@e[name=' + name + ',limit=1]');
    if (length(found) == 0, return('actor not found: ' + name));
    if (length(points) < 2, return('butuh minimal 2 waypoint'));
    global_actor = found:0;
    global_points = points;
    global_idx = 0;
    global_speed = speed;
    global_active = true;
    'following'
);

__on_tick() -> (
    if (!global_active, return());
    if (!(global_actor ~ 'exists'), (global_active = false; return()));
    if (global_idx >= length(global_points), (global_active = false; return()));
    target = global_points:global_idx;
    p = global_actor ~ 'pos';
    d = [target:0 - p:0, 0, target:2 - p:2];
    dist = sqrt(d:0 * d:0 + d:2 * d:2);
    if (dist < global_speed,
        modify(global_actor, 'pos', [target:0, p:1, target:2]);
        global_idx = global_idx + 1;
        return()
    );
    ux = d:0 / dist;
    uz = d:2 / dist;
    yaw = atan2(ux, uz) * 57.29577951;
    modify(global_actor, 'motion', [ux * global_speed, 0, uz * global_speed]);
    modify(global_actor, 'pos', [p:0 + ux * global_speed, p:1, p:2 + uz * global_speed]);
    modify(global_actor, 'nbt', 'merge', {'Rotation': [yaw, 0.0]});
);
