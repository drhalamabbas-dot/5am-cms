/* مولَّد آليًا من assets/js/site.js — لا يُحرَّر بيد.
   أعِد التوليد بـ:  node scripts/extract-icons.mjs
   الغرض: أن يكون شكل الأيقونات في الموقع الجديد مطابقًا للقديم تمامًا. */

/** نص الأيقونة كما هو في الموقع القديم. */
export const ico = {
  "arrow": "<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg>",
  "chev": "<svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m9 18 6-6-6-6\"/></svg>",
  "drag": "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 6 4 12l5 6M15 6l5 6-5 6\"/></svg>",
  "chevL": "<svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m15 18-6-6 6-6\"/></svg>",
  "chevR": "<svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m9 18 6-6-6-6\"/></svg>",
  "caret": "<svg class=\"caret\" width=\"11\" height=\"11\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\"/></svg>",
  "search": "<svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.5-3.5\"/></svg>",
  "globe": "<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18\"/></svg>",
  "play": "<svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M7 4.5v15l13-7.5z\"/></svg>",
  "pause": "<svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><rect x=\"6\" y=\"4.5\" width=\"4\" height=\"15\" rx=\"1\"/><rect x=\"14\" y=\"4.5\" width=\"4\" height=\"15\" rx=\"1\"/></svg>",
  "tick": "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5 9.2 18 20 6.5\"/></svg>",
  "dot": "<svg width=\"11\" height=\"11\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\"><path d=\"m9 6 6 6-6 6\"/></svg>",
  "pin": "<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\"><path d=\"M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z\"/><circle cx=\"12\" cy=\"10\" r=\"2.6\"/></svg>",
  "phone": "<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\"><path d=\"M5 3h4l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2.2 2A17 17 0 0 1 3 5.2 2 2 0 0 1 5 3Z\"/></svg>",
  "mail": "<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"m3.5 7 8.5 6 8.5-6\"/></svg>",
  "eye": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\"><path d=\"M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z\"/><circle cx=\"12\" cy=\"12\" r=\"2.8\"/></svg>",
  "target": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\"><circle cx=\"12\" cy=\"12\" r=\"8.5\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/></svg>",
  "gem": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linejoin=\"round\"><path d=\"M6 3h12l4 6-10 12L2 9Z\"/><path d=\"M2 9h20M9 3 7 9l5 12 5-12-2-6\"/></svg>",
  "shield": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\"><path d=\"M12 2.5 20 6v6c0 5-3.4 8.3-8 9.5C7.4 20.3 4 17 4 12V6Z\"/><path d=\"m8.5 12 2.6 2.6L16 9.5\"/></svg>",
  "bolt": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linejoin=\"round\"><path d=\"M13 2 4 14h6l-1 8 9-12h-6Z\"/></svg>",
  "cube": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linejoin=\"round\"><path d=\"M12 2.5 20.5 7v10L12 21.5 3.5 17V7Z\"/><path d=\"M3.5 7 12 11.7 20.5 7M12 11.7v9.8\"/></svg>",
  "leaf": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M4 20c0-9 6-15 16-15 0 10-5.5 15-14 15\"/><path d=\"M4 20c3.5-5 7-8 12-10\"/></svg>",
  "wrench": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 3.5a5.5 5.5 0 0 0-5 7.8L3.7 17.6a2 2 0 1 0 2.8 2.8l6.3-6.3A5.5 5.5 0 1 0 15 3.5Z\"/></svg>",
  "calendar": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15\" rx=\"2\"/><path d=\"M3.5 10h17M8 3v4M16 3v4\"/></svg>",
  "tool": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linejoin=\"round\"><path d=\"M14.5 3.5a4.5 4.5 0 0 0 5.8 5.8l-9.6 9.6a2.4 2.4 0 0 1-3.4-3.4Z\"/><path d=\"m5 5 3 3\"/></svg>",
  "truck": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M2 7h11v9H2zM13 10h4.5l3 3v3H13z\"/><circle cx=\"6.5\" cy=\"18\" r=\"1.8\"/><circle cx=\"17\" cy=\"18\" r=\"1.8\"/></svg>",
  "search2": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><circle cx=\"11\" cy=\"11\" r=\"6.5\"/><path d=\"m19.5 19.5-3.8-3.8\"/></svg>",
  "alert": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"><path d=\"M12 4 2.8 20h18.4Z\"/><path d=\"M12 10v4M12 17.2v.2\"/></svg>",
  "headset": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M4 14v-2a8 8 0 0 1 16 0v2\"/><rect x=\"2.5\" y=\"13\" width=\"4.5\" height=\"6\" rx=\"1.6\"/><rect x=\"17\" y=\"13\" width=\"4.5\" height=\"6\" rx=\"1.6\"/><path d=\"M20 19v.5a2.5 2.5 0 0 1-2.5 2.5H13\"/></svg>",
  "shield2": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M12 2.5 20 6v6c0 5-3.4 8.3-8 9.5C7.4 20.3 4 17 4 12V6Z\"/></svg>",
  "building": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M4 21V8l8-5 8 5v13\"/><path d=\"M9 21v-6h6v6M4 21h16\"/></svg>",
  "crane": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M4 21V5h3l13 4M7 5l8 16M15 9v5\"/></svg>",
  "factory": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M3 21V10l6 4V10l6 4V6h6v15Z\"/></svg>",
  "drop": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M12 3s6 6.6 6 10.5A6 6 0 0 1 6 13.5C6 9.6 12 3 12 3Z\"/></svg>",
  "home": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M3.5 11 12 4l8.5 7\"/><path d=\"M5.5 9.5V20h13V9.5\"/></svg>",
  "clock": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M12 7v5.2l3.2 2\"/></svg>",
  "users": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><circle cx=\"9\" cy=\"8\" r=\"3.4\"/><path d=\"M2.5 20c0-3.6 2.9-5.6 6.5-5.6s6.5 2 6.5 5.6\"/><path d=\"M16 5.2a3.4 3.4 0 0 1 0 6.6M17.6 14.8c2.4.6 3.9 2.4 3.9 5.2\"/></svg>",
  "layers": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linejoin=\"round\"><path d=\"m12 3 9 4.5-9 4.5-9-4.5Z\"/><path d=\"m3 12.5 9 4.5 9-4.5\"/></svg>",
  "doc": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M6 2.5h8l4 4V21.5H6Z\"/><path d=\"M14 2.5v4h4M9 12h6M9 16h6\"/></svg>",
  "info": "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v5M12 7.6v.2\"/></svg>",
  "linkedin": "<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M4.5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM2.9 9.2h3.2V21H2.9zM9 9.2h3v1.6c.5-.9 1.7-1.9 3.6-1.9 3.1 0 4.4 2 4.4 5.2V21h-3.2v-6c0-1.7-.6-2.7-2-2.7-1.2 0-1.9.8-2.2 1.6-.1.3-.1.7-.1 1.1V21H9Z\"/></svg>",
  "facebook": "<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H16.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.3V13h2.7v8z\"/></svg>",
  "youtube": "<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3Z\"/></svg>"
} as const;

/** الأيقونة مفكّكة إلى خصائص ومحتوى، لترسم <svg> بلا عنصر غلاف. */
export const icoParts: Record<string, { attrs: Record<string, string>; inner: string }> =
  {
  "arrow": {
    "attrs": {
      "width": "15",
      "height": "15",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "2.2",
      "strokeLinecap": "round",
      "strokeLinejoin": "round"
    },
    "inner": "<path d=\"M5 12h13M13 6l6 6-6 6\"/>"
  },
  "chev": {
    "attrs": {
      "width": "13",
      "height": "13",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "2.4",
      "strokeLinecap": "round",
      "strokeLinejoin": "round"
    },
    "inner": "<path d=\"m9 18 6-6-6-6\"/>"
  },
  "drag": {
    "attrs": {
      "width": "14",
      "height": "14",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "2.4",
      "strokeLinecap": "round",
      "strokeLinejoin": "round"
    },
    "inner": "<path d=\"M9 6 4 12l5 6M15 6l5 6-5 6\"/>"
  },
  "chevL": {
    "attrs": {
      "width": "17",
      "height": "17",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "2.2",
      "strokeLinecap": "round",
      "strokeLinejoin": "round"
    },
    "inner": "<path d=\"m15 18-6-6 6-6\"/>"
  },
  "chevR": {
    "attrs": {
      "width": "17",
      "height": "17",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "2.2",
      "strokeLinecap": "round",
      "strokeLinejoin": "round"
    },
    "inner": "<path d=\"m9 18 6-6-6-6\"/>"
  },
  "caret": {
    "attrs": {
      "className": "caret",
      "width": "11",
      "height": "11",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "2.6",
      "strokeLinecap": "round",
      "strokeLinejoin": "round"
    },
    "inner": "<path d=\"m6 9 6 6 6-6\"/>"
  },
  "search": {
    "attrs": {
      "width": "17",
      "height": "17",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "2",
      "strokeLinecap": "round"
    },
    "inner": "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.5-3.5\"/>"
  },
  "globe": {
    "attrs": {
      "width": "15",
      "height": "15",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.9"
    },
    "inner": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18\"/>"
  },
  "play": {
    "attrs": {
      "width": "12",
      "height": "12",
      "viewBox": "0 0 24 24",
      "fill": "currentColor"
    },
    "inner": "<path d=\"M7 4.5v15l13-7.5z\"/>"
  },
  "pause": {
    "attrs": {
      "width": "12",
      "height": "12",
      "viewBox": "0 0 24 24",
      "fill": "currentColor"
    },
    "inner": "<rect x=\"6\" y=\"4.5\" width=\"4\" height=\"15\" rx=\"1\"/><rect x=\"14\" y=\"4.5\" width=\"4\" height=\"15\" rx=\"1\"/>"
  },
  "tick": {
    "attrs": {
      "width": "14",
      "height": "14",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "2.6",
      "strokeLinecap": "round",
      "strokeLinejoin": "round"
    },
    "inner": "<path d=\"M4 12.5 9.2 18 20 6.5\"/>"
  },
  "dot": {
    "attrs": {
      "width": "11",
      "height": "11",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "3",
      "strokeLinecap": "round"
    },
    "inner": "<path d=\"m9 6 6 6-6 6\"/>"
  },
  "pin": {
    "attrs": {
      "width": "15",
      "height": "15",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.9"
    },
    "inner": "<path d=\"M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z\"/><circle cx=\"12\" cy=\"10\" r=\"2.6\"/>"
  },
  "phone": {
    "attrs": {
      "width": "15",
      "height": "15",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.9"
    },
    "inner": "<path d=\"M5 3h4l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2.2 2A17 17 0 0 1 3 5.2 2 2 0 0 1 5 3Z\"/>"
  },
  "mail": {
    "attrs": {
      "width": "15",
      "height": "15",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.9"
    },
    "inner": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"m3.5 7 8.5 6 8.5-6\"/>"
  },
  "eye": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.9"
    },
    "inner": "<path d=\"M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z\"/><circle cx=\"12\" cy=\"12\" r=\"2.8\"/>"
  },
  "target": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.9"
    },
    "inner": "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/>"
  },
  "gem": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8",
      "strokeLinejoin": "round"
    },
    "inner": "<path d=\"M6 3h12l4 6-10 12L2 9Z\"/><path d=\"M2 9h20M9 3 7 9l5 12 5-12-2-6\"/>"
  },
  "shield": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.9"
    },
    "inner": "<path d=\"M12 2.5 20 6v6c0 5-3.4 8.3-8 9.5C7.4 20.3 4 17 4 12V6Z\"/><path d=\"m8.5 12 2.6 2.6L16 9.5\"/>"
  },
  "bolt": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.9",
      "strokeLinejoin": "round"
    },
    "inner": "<path d=\"M13 2 4 14h6l-1 8 9-12h-6Z\"/>"
  },
  "cube": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8",
      "strokeLinejoin": "round"
    },
    "inner": "<path d=\"M12 2.5 20.5 7v10L12 21.5 3.5 17V7Z\"/><path d=\"M3.5 7 12 11.7 20.5 7M12 11.7v9.8\"/>"
  },
  "leaf": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8"
    },
    "inner": "<path d=\"M4 20c0-9 6-15 16-15 0 10-5.5 15-14 15\"/><path d=\"M4 20c3.5-5 7-8 12-10\"/>"
  },
  "wrench": {
    "attrs": {
      "width": "18",
      "height": "18",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8",
      "strokeLinecap": "round",
      "strokeLinejoin": "round"
    },
    "inner": "<path d=\"M15 3.5a5.5 5.5 0 0 0-5 7.8L3.7 17.6a2 2 0 1 0 2.8 2.8l6.3-6.3A5.5 5.5 0 1 0 15 3.5Z\"/>"
  },
  "calendar": {
    "attrs": {
      "width": "18",
      "height": "18",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8"
    },
    "inner": "<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15\" rx=\"2\"/><path d=\"M3.5 10h17M8 3v4M16 3v4\"/>"
  },
  "tool": {
    "attrs": {
      "width": "18",
      "height": "18",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8",
      "strokeLinejoin": "round"
    },
    "inner": "<path d=\"M14.5 3.5a4.5 4.5 0 0 0 5.8 5.8l-9.6 9.6a2.4 2.4 0 0 1-3.4-3.4Z\"/><path d=\"m5 5 3 3\"/>"
  },
  "truck": {
    "attrs": {
      "width": "18",
      "height": "18",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8"
    },
    "inner": "<path d=\"M2 7h11v9H2zM13 10h4.5l3 3v3H13z\"/><circle cx=\"6.5\" cy=\"18\" r=\"1.8\"/><circle cx=\"17\" cy=\"18\" r=\"1.8\"/>"
  },
  "search2": {
    "attrs": {
      "width": "18",
      "height": "18",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8"
    },
    "inner": "<circle cx=\"11\" cy=\"11\" r=\"6.5\"/><path d=\"m19.5 19.5-3.8-3.8\"/>"
  },
  "alert": {
    "attrs": {
      "width": "18",
      "height": "18",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8",
      "strokeLinecap": "round"
    },
    "inner": "<path d=\"M12 4 2.8 20h18.4Z\"/><path d=\"M12 10v4M12 17.2v.2\"/>"
  },
  "headset": {
    "attrs": {
      "width": "18",
      "height": "18",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8"
    },
    "inner": "<path d=\"M4 14v-2a8 8 0 0 1 16 0v2\"/><rect x=\"2.5\" y=\"13\" width=\"4.5\" height=\"6\" rx=\"1.6\"/><rect x=\"17\" y=\"13\" width=\"4.5\" height=\"6\" rx=\"1.6\"/><path d=\"M20 19v.5a2.5 2.5 0 0 1-2.5 2.5H13\"/>"
  },
  "shield2": {
    "attrs": {
      "width": "18",
      "height": "18",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8"
    },
    "inner": "<path d=\"M12 2.5 20 6v6c0 5-3.4 8.3-8 9.5C7.4 20.3 4 17 4 12V6Z\"/>"
  },
  "building": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8"
    },
    "inner": "<path d=\"M4 21V8l8-5 8 5v13\"/><path d=\"M9 21v-6h6v6M4 21h16\"/>"
  },
  "crane": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8"
    },
    "inner": "<path d=\"M4 21V5h3l13 4M7 5l8 16M15 9v5\"/>"
  },
  "factory": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8"
    },
    "inner": "<path d=\"M3 21V10l6 4V10l6 4V6h6v15Z\"/>"
  },
  "drop": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8"
    },
    "inner": "<path d=\"M12 3s6 6.6 6 10.5A6 6 0 0 1 6 13.5C6 9.6 12 3 12 3Z\"/>"
  },
  "home": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8"
    },
    "inner": "<path d=\"M3.5 11 12 4l8.5 7\"/><path d=\"M5.5 9.5V20h13V9.5\"/>"
  },
  "clock": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8"
    },
    "inner": "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M12 7v5.2l3.2 2\"/>"
  },
  "users": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8"
    },
    "inner": "<circle cx=\"9\" cy=\"8\" r=\"3.4\"/><path d=\"M2.5 20c0-3.6 2.9-5.6 6.5-5.6s6.5 2 6.5 5.6\"/><path d=\"M16 5.2a3.4 3.4 0 0 1 0 6.6M17.6 14.8c2.4.6 3.9 2.4 3.9 5.2\"/>"
  },
  "layers": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8",
      "strokeLinejoin": "round"
    },
    "inner": "<path d=\"m12 3 9 4.5-9 4.5-9-4.5Z\"/><path d=\"m3 12.5 9 4.5 9-4.5\"/>"
  },
  "doc": {
    "attrs": {
      "width": "16",
      "height": "16",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "1.8"
    },
    "inner": "<path d=\"M6 2.5h8l4 4V21.5H6Z\"/><path d=\"M14 2.5v4h4M9 12h6M9 16h6\"/>"
  },
  "info": {
    "attrs": {
      "width": "14",
      "height": "14",
      "viewBox": "0 0 24 24",
      "fill": "none",
      "stroke": "currentColor",
      "strokeWidth": "2"
    },
    "inner": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v5M12 7.6v.2\"/>"
  },
  "linkedin": {
    "attrs": {
      "width": "15",
      "height": "15",
      "viewBox": "0 0 24 24",
      "fill": "currentColor"
    },
    "inner": "<path d=\"M4.5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM2.9 9.2h3.2V21H2.9zM9 9.2h3v1.6c.5-.9 1.7-1.9 3.6-1.9 3.1 0 4.4 2 4.4 5.2V21h-3.2v-6c0-1.7-.6-2.7-2-2.7-1.2 0-1.9.8-2.2 1.6-.1.3-.1.7-.1 1.1V21H9Z\"/>"
  },
  "facebook": {
    "attrs": {
      "width": "15",
      "height": "15",
      "viewBox": "0 0 24 24",
      "fill": "currentColor"
    },
    "inner": "<path d=\"M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H16.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.3V13h2.7v8z\"/>"
  },
  "youtube": {
    "attrs": {
      "width": "15",
      "height": "15",
      "viewBox": "0 0 24 24",
      "fill": "currentColor"
    },
    "inner": "<path d=\"M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3Z\"/>"
  }
};

export type IconName = keyof typeof ico;
