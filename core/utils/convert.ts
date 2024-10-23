const lr = ['shift', 'win', 'control', 'menu', 'button'];
const special_char = {
    special: `!@#$%^&*()_+{}:"<>?|~`.split(''),
    normal: `1234567890-=[];',./\\\``.split('')
};

export function useShift(char: string): boolean {
    if (char.length != 1) return false;
    else if (char.toLowerCase() != char) return true;
    else if (special_char.special.includes(char)) return true;
    return false;
}
export function convertJSKey(
    key: string,
    position: number
): number | undefined {
    const index = special_char.special.findIndex((x) => x == key);
    if (index != -1) return code[special_char.normal[index]];

    let lower = key.toLowerCase();
    if (lower == 'alt') lower = 'menu';
    else if (lower == 'meta') lower = 'win';
    else if (lower == 'capslock') lower = 'capital';
    else if (lower == 'enter') lower = 'return';
    else if (lower == ' ') lower = 'space';
    else if (lower == 'backspace') lower = 'back';
    //else if (lower == "f1")
    //    lower = "escape"
    else if (lower.includes('arrow')) lower = lower.split('arrow').at(1);

    return code[
        (lr.includes(lower)
            ? position == KeyboardEvent.DOM_KEY_LOCATION_LEFT
                ? 'l'
                : position == KeyboardEvent.DOM_KEY_LOCATION_RIGHT
                  ? 'r'
                  : ''
            : '') + lower
    ];
}

const default_code = {
    lbutton: 0x01,
    rbutton: 0x02,

    cancel: 0x03,
    mbutton: 0x04,
    xbutton1: 0x05,
    xbutton2: 0x06,
    back: 0x08,
    tab: 0x09,
    clear: 0x0c,
    return: 0x0d,
    shift: 0x10,
    control: 0x11,
    menu: 0x12,
    pause: 0x13,
    capital: 0x14,
    kana: 0x15,
    hangul: 0x15,
    junja: 0x17,
    final: 0x18,
    hanja: 0x19,
    kanji: 0x19,
    escape: 0x1b,
    convert: 0x1c,
    nonconvert: 0x1d,
    accept: 0x1e,
    modechange: 0x1f,
    space: 0x20,
    prior: 0x21,
    next: 0x22,
    end: 0x23,
    home: 0x24,
    left: 0x25,
    up: 0x26,
    right: 0x27,
    down: 0x28,
    select: 0x29,
    print: 0x2a,
    execute: 0x2b,
    snapshot: 0x2c,
    insert: 0x2d,
    delete: 0x2e,
    help: 0x2f,

    '0': 0x30,
    '1': 0x31,
    '2': 0x32,
    '3': 0x33,
    '4': 0x34,
    '5': 0x35,
    '6': 0x36,
    '7': 0x37,
    '8': 0x38,
    '9': 0x39,
    a: 0x41,
    b: 0x42,
    c: 0x43,
    d: 0x44,
    e: 0x45,
    f: 0x46,
    g: 0x47,
    h: 0x48,
    i: 0x49,
    j: 0x4a,
    k: 0x4b,
    l: 0x4c,
    m: 0x4d,
    n: 0x4e,
    o: 0x4f,
    p: 0x50,
    q: 0x51,
    r: 0x52,
    s: 0x53,
    t: 0x54,
    u: 0x55,
    v: 0x56,
    w: 0x57,
    x: 0x58,
    y: 0x59,
    z: 0x5a,

    lwin: 0x5b,
    //   "rwin"                : 0x5C,
    apps: 0x5d,
    sleep: 0x5f,

    numpad0: 0x60,
    numpad1: 0x61,
    numpad2: 0x62,
    numpad3: 0x63,
    numpad4: 0x64,
    numpad5: 0x65,
    numpad6: 0x66,
    numpad7: 0x67,
    numpad8: 0x68,
    numpad9: 0x69,

    multiply: 0x6a,
    add: 0x6b,
    separator: 0x6c,
    subtract: 0x6d,
    decimal: 0x6e,
    divide: 0x6f,

    f1: 0x70,
    f2: 0x71,
    f3: 0x72,
    f4: 0x73,
    f5: 0x74,
    f6: 0x75,
    f7: 0x76,
    f8: 0x77,
    f9: 0x78,
    f10: 0x79,
    f11: 0x7a,
    f12: 0x7b,
    f13: 0x7c,
    f14: 0x7d,
    f15: 0x7e,
    f16: 0x7f,
    f17: 0x80,
    f18: 0x81,
    f19: 0x82,
    f20: 0x83,
    f21: 0x84,
    f22: 0x85,
    f23: 0x86,
    f24: 0x87,
    numlock: 0x90,
    scroll: 0x91,

    lshift: 0xa0,
    rshift: 0xa1,
    lcontrol: 0xa2,
    rcontrol: 0xa3,
    lmenu: 0xa4,
    rmenu: 0xa5,

    browser_back: 0xa6,
    browser_forward: 0xa7,
    browser_refresh: 0xa8,
    browser_stop: 0xa9,
    browser_search: 0xaa,
    browser_favorites: 0xab,
    browser_home: 0xac,
    volume_mute: 0xad,
    volume_down: 0xae,
    volume_up: 0xaf,
    media_next_track: 0xb0,
    media_prev_track: 0xb1,
    media_stop: 0xb2,
    media_play_pause: 0xb3,
    launch_mail: 0xb4,
    launch_media_select: 0xb5,
    launch_app1: 0xb6,
    launch_app2: 0xb7,

    ';': 0xba,
    '=': 0xbb,
    ',': 0xbc,
    '-': 0xbd,
    '.': 0xbe,
    '/': 0xbf,
    '`': 0xc0,
    '[': 0xdb,
    '\\': 0xdc,
    ']': 0xdd,
    "'": 0xde,
    oem_8: 0xdf,
    oem_102: 0xe2,

    processkey: 0xe5,
    packet: 0xe7,
    attn: 0xf6,
    crsel: 0xf7,
    exsel: 0xf8,
    ereof: 0xf9,
    play: 0xfa,
    zoom: 0xfb,
    noname: 0xfc,
    pa1: 0xfd,
    oem_clear: 0xfe
};

let code = default_code;
export function SwapKey(map: { from: string; to: string }[]) {
    code = default_code;
    map.forEach((m) => {
        const { from, to } = m;
        code[from] = default_code[to];
    });
}
