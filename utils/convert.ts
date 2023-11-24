const lr = ['shift','win','control','menu','button']
const special_char = {
    special : `!@#$%^&*()_+{}:"<>?|~`.split(""),
    normal  : `1234567890-=[];',./\\\``.split("")
}

export function useShift(char: string) : boolean {
    if (char.length != 1) 
        return false
    else if (char.toLowerCase() != char)
        return true
    else if (special_char.special.includes(char))
        return true
    return false
}
export function convertJSKey(key: string, position: number) : number | undefined {
    const index = special_char.special.findIndex(x => x == key)
    if (index != -1) 
        return code[special_char.normal[index]]

    let lower = key.toLowerCase()
    if (lower == "alt") 
        lower = "menu"
    else if (lower == "meta") 
        lower = "win"
    else if (lower == "capslock") 
        lower = "capital"
    else if (lower == "enter") 
        lower = "return"
    else if (lower == " ") 
        lower = "space"
    else if (lower == "backspace") 
        lower = "back"
    //else if (lower == "f1")
    //    lower = "escape"
    else if (lower.includes("arrow")) 
        lower = lower.split("arrow").at(1)
    
    return code[(lr.includes(lower) ? 
        (position  == KeyboardEvent.DOM_KEY_LOCATION_LEFT 
        ? "l" 
        : position == KeyboardEvent.DOM_KEY_LOCATION_RIGHT
        ? "r"
        : "") 
        : "") + lower]
}


const default_code = {
  "lbutton"             : 0x01,
  "rbutton"             : 0x02,

  "cancel"              : 0x03,
  "mbutton"             : 0x04,
  "xbutton1"            : 0x05,
  "xbutton2"            : 0x06,
  "back"                : 0x08,
  "tab"                 : 0x09,
  "clear"               : 0x0C,
  "return"              : 0x0D,
  "shift"               : 0x10,
  "control"             : 0x11,
  "menu"                : 0x12,
  "pause"               : 0x13,
  "capital"             : 0x14,
  "kana"                : 0x15,
  "hangul"              : 0x15,
  "junja"               : 0x17,
  "final"               : 0x18,
  "hanja"               : 0x19,
  "kanji"               : 0x19,
  "escape"              : 0x1B,
  "convert"             : 0x1C,
  "nonconvert"          : 0x1D,
  "accept"              : 0x1E,
  "modechange"          : 0x1F,
  "space"               : 0x20,
  "prior"               : 0x21,
  "next"                : 0x22,
  "end"                 : 0x23,
  "home"                : 0x24,
  "left"                : 0x25,
  "up"                  : 0x26,
  "right"               : 0x27,
  "down"                : 0x28,
  "select"              : 0x29,
  "print"               : 0x2A,
  "execute"             : 0x2B,
  "snapshot"            : 0x2C,
  "insert"              : 0x2D,
  "delete"              : 0x2E,
  "help"                : 0x2F,

  "0"                   : 0x30,
  "1"                   : 0x31,
  "2"                   : 0x32,
  "3"                   : 0x33,
  "4"                   : 0x34,
  "5"                   : 0x35,
  "6"                   : 0x36,
  "7"                   : 0x37,
  "8"                   : 0x38,
  "9"                   : 0x39,
  "a"                   : 0x41,
  "b"                   : 0x42,
  "c"                   : 0x43,
  "d"                   : 0x44,
  "e"                   : 0x45,
  "f"                   : 0x46,
  "g"                   : 0x47,
  "h"                   : 0x48,
  "i"                   : 0x49,
  "j"                   : 0x4A,
  "k"                   : 0x4B,
  "l"                   : 0x4C,
  "m"                   : 0x4D,
  "n"                   : 0x4E,
  "o"                   : 0x4F,
  "p"                   : 0x50,
  "q"                   : 0x51,
  "r"                   : 0x52,
  "s"                   : 0x53,
  "t"                   : 0x54,
  "u"                   : 0x55,
  "v"                   : 0x56,
  "w"                   : 0x57,
  "x"                   : 0x58,
  "y"                   : 0x59,
  "z"                   : 0x5A,

  "lwin"                : 0x5B,
//   "rwin"                : 0x5C,
  "apps"                : 0x5D,
  "sleep"               : 0x5F,

  "numpad0"             : 0x60,
  "numpad1"             : 0x61,
  "numpad2"             : 0x62,
  "numpad3"             : 0x63,
  "numpad4"             : 0x64,
  "numpad5"             : 0x65,
  "numpad6"             : 0x66,
  "numpad7"             : 0x67,
  "numpad8"             : 0x68,
  "numpad9"             : 0x69,

  "multiply"            : 0x6A,
  "add"                 : 0x6B,
  "separator"           : 0x6C,
  "subtract"            : 0x6D,
  "decimal"             : 0x6E,
  "divide"              : 0x6F,

  "f1"                  : 0x70,
  "f2"                  : 0x71,
  "f3"                  : 0x72,
  "f4"                  : 0x73,
  "f5"                  : 0x74,
  "f6"                  : 0x75,
  "f7"                  : 0x76,
  "f8"                  : 0x77,
  "f9"                  : 0x78,
  "f10"                 : 0x79,
  "f11"                 : 0x7A,
  "f12"                 : 0x7B,
  "f13"                 : 0x7C,
  "f14"                 : 0x7D,
  "f15"                 : 0x7E,
  "f16"                 : 0x7F,
  "f17"                 : 0x80,
  "f18"                 : 0x81,
  "f19"                 : 0x82,
  "f20"                 : 0x83,
  "f21"                 : 0x84,
  "f22"                 : 0x85,
  "f23"                 : 0x86,
  "f24"                 : 0x87,
  "numlock"             : 0x90,
  "scroll"              : 0x91,

  "lshift"              : 0xA0,
  "rshift"              : 0xA1,
  "lcontrol"            : 0xA2,
  "rcontrol"            : 0xA3,
  "lmenu"               : 0xA4,
  "rmenu"               : 0xA5,

  "browser_back"        : 0xA6,
  "browser_forward"     : 0xA7,
  "browser_refresh"     : 0xA8,
  "browser_stop"        : 0xA9,
  "browser_search"      : 0xAA,
  "browser_favorites"   : 0xAB,
  "browser_home"        : 0xAC,
  "volume_mute"         : 0xAD,
  "volume_down"         : 0xAE,
  "volume_up"           : 0xAF,
  "media_next_track"    : 0xB0,
  "media_prev_track"    : 0xB1,
  "media_stop"          : 0xB2,
  "media_play_pause"    : 0xB3,
  "launch_mail"         : 0xB4,
  "launch_media_select" : 0xB5,
  "launch_app1"         : 0xB6,
  "launch_app2"         : 0xB7,

  ";"                   : 0xBA,
  "="                   : 0xBB,
  ","                   : 0xBC,
  "-"                   : 0xBD,
  "."                   : 0xBE,
  "/"                   : 0xBF,
  "`"                   : 0xC0,
  "["                   : 0xDB,
  "\\"                  : 0xDC,
  "]"                   : 0xDD,
  "'"                   : 0xDE,
  "oem_8"               : 0xDF,
  "oem_102"             : 0xE2,

  "processkey"          : 0xE5,
  "packet"              : 0xE7,
  "attn"                : 0xF6,
  "crsel"               : 0xF7,
  "exsel"               : 0xF8,
  "ereof"               : 0xF9,
  "play"                : 0xFA,
  "zoom"                : 0xFB,
  "noname"              : 0xFC,
  "pa1"                 : 0xFD,
  "oem_clear"           : 0xFE,
}

let code = default_code
export function SwapKey(map: {from:string,to:string}[]) {
    code = default_code
    map.forEach((m) => {
        const {from,to} = m
        code[from] = default_code[to]
    })
}