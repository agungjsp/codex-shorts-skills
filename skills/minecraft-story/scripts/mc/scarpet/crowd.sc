// crowd.sc — kerumunan mob (Carpet scarpet, MC 1.20.1)
// Load : /script load crowd
// Call : /script in crowd run wander('minecraft:villager',50,[0,65,0],14,2)   (semua argumen wajib diisi)
//        /script in crowd run march('minecraft:pillager',20,[-40,65,20],[40,65,20],0.055)
//        /script in crowd run stop()
//        /script in crowd run clear()
//
// Catatan: `march` memindahkan mob dengan pos+motion (bukan pathfinding).
// Kalau di close-up terlihat sliding, pakai `wander` (AI asli) atau animasikan lewat BBS.

__config() -> {'scope' -> 'global', 'stay_loaded' -> true};

global_actors = [];
global_mode = 'idle';
global_dir = [0, 0, 0];
global_speed = 0.0;

reset() -> (
    global_actors = [];
    global_mode = 'idle';
    global_dir = [0, 0, 0];
    global_speed = 0.0;
    'reset'
);

clear() -> (
    for (global_actors, modify(_, 'removed', true));
    reset()
);

stop() -> (
    global_mode = 'idle';
    'stopped'
);

// Sebar mob dalam cincin (deterministik, bukan acak) lalu biarkan AI jalan sendiri.
// inner = radius kosong di tengah (hindari sumur/props).
wander(type, count, center, radius, inner) -> (
    reset();
    if (inner == null, inner = 2);
    n = 0;
    loop(count,
        a = _ * 2.39996323;
        r = inner + (radius - inner) * sqrt((_ + 0.5) / count);
        p = [center:0 + r * cos(a), center:1, center:2 + r * sin(a)];
        e = spawn(type, p);
        if (e != null,
            modify(e, 'persistence', true);
            global_actors = global_actors + [e];
            n = n + 1
        )
    );
    n
);

// Barisan rapat dari `from` ke `to`, lalu bergerak sepanjang arah itu.
march(type, count, from, to, speed) -> (
    reset();
    dx = to:0 - from:0;
    dz = to:2 - from:2;
    len = sqrt(dx * dx + dz * dz);
    if (len < 0.001, return('bad path'));
    ux = dx / len;
    uz = dz / len;
    px = -uz;
    pz = ux;
    n = 0;
    loop(count,
        off = (_ - (count - 1) / 2) * 0.9;
        p = [from:0 + px * off, from:1, from:2 + pz * off];
        e = spawn(type, p);
        if (e != null,
            modify(e, 'persistence', true);
            global_actors = global_actors + [e];
            n = n + 1
        )
    );
    global_mode = 'march';
    global_dir = [ux, 0, uz];
    global_speed = speed;
    n
);

__on_tick() -> (
    if (global_mode != 'march', return());
    if (length(global_actors) == 0, return());
    d = global_dir * global_speed;
    yaw = atan2(global_dir:0, global_dir:2) * 57.29577951;
    for (global_actors,
        if (_ ~ 'exists',
            modify(_, 'motion', d);
            modify(_, 'pos', _ ~ 'pos' + d);
            modify(_, 'nbt', 'merge', {'Rotation': [yaw, 0.0]})
        )
    );
);
