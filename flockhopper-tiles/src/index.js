var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/fflate/esm/browser.js
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = /* @__PURE__ */ __name(function(eb, start) {
  var b2 = new u16(31);
  for (var i = 0; i < 31; ++i) {
    b2[i] = start += 1 << eb[i - 1];
  }
  var r = new i32(b2[30]);
  for (var i = 1; i < 30; ++i) {
    for (var j2 = b2[i]; j2 < b2[i + 1]; ++j2) {
      r[j2] = j2 - b2[i] << 5 | i;
    }
  }
  return { b: b2, r };
}, "freb");
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x2 = (i & 43690) >> 1 | (i & 21845) << 1;
  x2 = (x2 & 52428) >> 2 | (x2 & 13107) << 2;
  x2 = (x2 & 61680) >> 4 | (x2 & 3855) << 4;
  rev[i] = ((x2 & 65280) >> 8 | (x2 & 255) << 8) >> 1;
}
var x2;
var i;
var hMap = /* @__PURE__ */ __name((function(cd, mb, r) {
  var s = cd.length;
  var i = 0;
  var l2 = new u16(mb);
  for (; i < s; ++i) {
    if (cd[i])
      ++l2[cd[i] - 1];
  }
  var le = new u16(mb);
  for (i = 1; i < mb; ++i) {
    le[i] = le[i - 1] + l2[i - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        var sv = i << 4 | cd[i];
        var r_1 = mb - cd[i];
        var v2 = le[cd[i] - 1]++ << r_1;
        for (var m2 = v2 | (1 << r_1) - 1; v2 <= m2; ++v2) {
          co[rev[v2] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
      }
    }
  }
  return co;
}), "hMap");
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = /* @__PURE__ */ __name(function(a) {
  var m2 = a[0];
  for (var i = 1; i < a.length; ++i) {
    if (a[i] > m2)
      m2 = a[i];
  }
  return m2;
}, "max");
var bits = /* @__PURE__ */ __name(function(d, p, m2) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m2;
}, "bits");
var bits16 = /* @__PURE__ */ __name(function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
}, "bits16");
var shft = /* @__PURE__ */ __name(function(p) {
  return (p + 7) / 8 | 0;
}, "shft");
var slc = /* @__PURE__ */ __name(function(v2, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v2.length)
    e = v2.length;
  return new u8(v2.subarray(s, e));
}, "slc");
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = /* @__PURE__ */ __name(function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
}, "err");
var inflt = /* @__PURE__ */ __name(function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = /* @__PURE__ */ __name(function(l3) {
    var bl = buf.length;
    if (l3 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l3));
      nbuf.set(buf);
      buf = nbuf;
    }
  }, "cbuf");
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l2 = dat[s - 4] | dat[s - 3] << 8, t = s + l2;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l2);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l2, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i = 0; i < hcLen; ++i) {
          clt[clim[i]] = bits(dat, pos + i * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i = 0; i < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i = sym - 257, b2 = fleb[i];
          add = bits(dat, pos, (1 << b2) - 1) + fl[i];
          pos += b2;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b2 = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b2) - 1, pos += b2;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
}, "inflt");
var et = /* @__PURE__ */ new u8(0);
var gzs = /* @__PURE__ */ __name(function(d) {
  if (d[0] != 31 || d[1] != 139 || d[2] != 8)
    err(6, "invalid gzip data");
  var flg = d[3];
  var st = 10;
  if (flg & 4)
    st += (d[10] | d[11] << 8) + 2;
  for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++])
    ;
  return st + (flg & 2);
}, "gzs");
var gzl = /* @__PURE__ */ __name(function(d) {
  var l2 = d.length;
  return (d[l2 - 4] | d[l2 - 3] << 8 | d[l2 - 2] << 16 | d[l2 - 1] << 24) >>> 0;
}, "gzl");
var zls = /* @__PURE__ */ __name(function(d, dict) {
  if ((d[0] & 15) != 8 || d[0] >> 4 > 7 || (d[0] << 8 | d[1]) % 31)
    err(6, "invalid zlib data");
  if ((d[1] >> 5 & 1) == +!dict)
    err(6, "invalid zlib data: " + (d[1] & 32 ? "need" : "unexpected") + " dictionary");
  return (d[1] >> 3 & 4) + 2;
}, "zls");
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
__name(inflateSync, "inflateSync");
function gunzipSync(data, opts) {
  var st = gzs(data);
  if (st + 8 > data.length)
    err(6, "invalid gzip data");
  return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);
}
__name(gunzipSync, "gunzipSync");
function unzlibSync(data, opts) {
  return inflt(data.subarray(zls(data, opts && opts.dictionary), -4), { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
__name(unzlibSync, "unzlibSync");
function decompressSync(data, opts) {
  return data[0] == 31 && data[1] == 139 && data[2] == 8 ? gunzipSync(data, opts) : (data[0] & 15) != 8 || data[0] >> 4 > 7 || (data[0] << 8 | data[1]) % 31 ? inflateSync(data, opts) : unzlibSync(data, opts);
}
__name(decompressSync, "decompressSync");
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}

// node_modules/pmtiles/dist/esm/index.js
var j = Object.defineProperty;
var B = Math.pow;
var l = /* @__PURE__ */ __name((o, t) => j(o, "name", { value: t, configurable: true }), "l");
var m = /* @__PURE__ */ __name((o, t, e) => new Promise((r, n) => {
  var s = /* @__PURE__ */ __name((c) => {
    try {
      a(e.next(c));
    } catch (u) {
      n(u);
    }
  }, "s"), i = /* @__PURE__ */ __name((c) => {
    try {
      a(e.throw(c));
    } catch (u) {
      n(u);
    }
  }, "i"), a = /* @__PURE__ */ __name((c) => c.done ? r(c.value) : Promise.resolve(c.value).then(s, i), "a");
  a((e = e.apply(o, t)).next());
}), "m");
var re = l((o, t) => {
  let e = false, r = "", n = L.GridLayer.extend({ createTile: l((s, i) => {
    let a = document.createElement("img"), c = new AbortController(), u = c.signal;
    return a.cancel = () => {
      c.abort();
    }, e || (o.getHeader().then((d) => {
      d.tileType === 1 ? console.error("Error: archive contains MVT vector tiles, but leafletRasterLayer is for displaying raster tiles. See https://github.com/protomaps/PMTiles/tree/main/js for details.") : d.tileType === 2 ? r = "image/png" : d.tileType === 3 ? r = "image/jpeg" : d.tileType === 4 ? r = "image/webp" : d.tileType === 5 && (r = "image/avif");
    }), e = true), o.getZxy(s.z, s.x, s.y, u).then((d) => {
      if (d) {
        let h = new Blob([d.data], { type: r }), p = window.URL.createObjectURL(h);
        a.src = p;
      } else a.style.display = "none";
      a.cancel = void 0, i(void 0, a);
    }).catch((d) => {
      if (d.name !== "AbortError") throw d;
    }), a;
  }, "createTile"), _removeTile: l(function(s) {
    let i = this._tiles[s];
    i && (i.el.cancel && i.el.cancel(), i.el.width = 0, i.el.height = 0, i.el.deleted = true, L.DomUtil.remove(i.el), delete this._tiles[s], this.fire("tileunload", { tile: i.el, coords: this._keyToTileCoords(s) }));
  }, "_removeTile") });
  return new n(t);
}, "leafletRasterLayer");
var W = l((o) => (t, e) => {
  if (e instanceof AbortController) return o(t, e);
  let r = new AbortController();
  return o(t, r).then((n) => e(void 0, n.data, n.cacheControl || "", n.expires || ""), (n) => e(n)).catch((n) => e(n)), { cancel: l(() => r.abort(), "cancel") };
}, "v3compat");
var E = class E2 {
  static {
    __name(this, "E");
  }
  constructor(t) {
    this.tilev4 = l((t2, e) => m(this, null, function* () {
      if (t2.type === "json") {
        let p = t2.url.substr(10), y = this.tiles.get(p);
        if (y || (y = new w(p), this.tiles.set(p, y)), this.metadata) {
          let z = yield y.getTileJson(t2.url);
          return e.signal.throwIfAborted(), { data: z };
        }
        let f = yield y.getHeader();
        return e.signal.throwIfAborted(), (f.minLon >= f.maxLon || f.minLat >= f.maxLat) && console.error(`Bounds of PMTiles archive ${f.minLon},${f.minLat},${f.maxLon},${f.maxLat} are not valid.`), { data: { tiles: [`${t2.url}/{z}/{x}/{y}`], minzoom: f.minZoom, maxzoom: f.maxZoom, bounds: [f.minLon, f.minLat, f.maxLon, f.maxLat] } };
      }
      let r = new RegExp(/pmtiles:\/\/(.+)\/(\d+)\/(\d+)\/(\d+)/), n = t2.url.match(r);
      if (!n) throw new Error("Invalid PMTiles protocol URL");
      let s = n[1], i = this.tiles.get(s);
      i || (i = new w(s), this.tiles.set(s, i));
      let a = n[2], c = n[3], u = n[4], d = yield i.getHeader(), h = yield i == null ? void 0 : i.getZxy(+a, +c, +u, e.signal);
      if (e.signal.throwIfAborted(), h) return { data: new Uint8Array(h.data), cacheControl: h.cacheControl, expires: h.expires };
      if (d.tileType === 1) {
        if (this.errorOnMissingTile) throw new Error("Tile not found.");
        return { data: new Uint8Array() };
      }
      return { data: null };
    }), "tilev4");
    this.tile = W(this.tilev4);
    this.tiles = /* @__PURE__ */ new Map(), this.metadata = (t == null ? void 0 : t.metadata) || false, this.errorOnMissingTile = (t == null ? void 0 : t.errorOnMissingTile) || false;
  }
  add(t) {
    this.tiles.set(t.source.getKey(), t);
  }
  get(t) {
    return this.tiles.get(t);
  }
};
l(E, "Protocol");
function b(o, t) {
  return (t >>> 0) * 4294967296 + (o >>> 0);
}
__name(b, "b");
l(b, "toNum");
function N(o, t) {
  let e = t.buf, r = e[t.pos++], n = (r & 112) >> 4;
  if (r < 128 || (r = e[t.pos++], n |= (r & 127) << 3, r < 128) || (r = e[t.pos++], n |= (r & 127) << 10, r < 128) || (r = e[t.pos++], n |= (r & 127) << 17, r < 128) || (r = e[t.pos++], n |= (r & 127) << 24, r < 128) || (r = e[t.pos++], n |= (r & 1) << 31, r < 128)) return b(o, n);
  throw new Error("Expected varint not more than 10 bytes");
}
__name(N, "N");
l(N, "readVarintRemainder");
function x(o) {
  let t = o.buf, e = t[o.pos++], r = e & 127;
  return e < 128 || (e = t[o.pos++], r |= (e & 127) << 7, e < 128) || (e = t[o.pos++], r |= (e & 127) << 14, e < 128) || (e = t[o.pos++], r |= (e & 127) << 21, e < 128) ? r : (e = t[o.pos], r |= (e & 15) << 28, N(r, o));
}
__name(x, "x");
l(x, "readVarint");
function k(o, t, e, r, n) {
  return n === 0 ? r !== 0 ? [o - 1 - e, o - 1 - t] : [e, t] : [t, e];
}
__name(k, "k");
l(k, "rotate");
function q(o, t, e) {
  if (o > 26) throw new Error("Tile zoom level exceeds max safe number limit (26)");
  if (t >= 1 << o || e >= 1 << o) throw new Error("tile x/y outside zoom level bounds");
  let r = ((1 << o) * (1 << o) - 1) / 3, n = o - 1, [s, i] = [t, e];
  for (let a = 1 << n; a > 0; a >>= 1) {
    let c = s & a, u = i & a;
    r += (3 * c ^ u) * (1 << n), [s, i] = k(a, s, i, c, u), n--;
  }
  return r;
}
__name(q, "q");
l(q, "zxyToTileId");
function G(o) {
  let t = 3 * o + 1;
  return t < 4294967296 ? 31 - Math.clz32(t) : 63 - Math.clz32(t / 4294967296);
}
__name(G, "G");
l(G, "tileIdToZ");
function ie(o) {
  let t = G(o) >> 1;
  if (t > 26) throw new Error("Tile zoom level exceeds max safe number limit (26)");
  let e = ((1 << t) * (1 << t) - 1) / 3, r = o - e, n = 0, s = 0, i = 1 << t;
  for (let a = 1; a < i; a <<= 1) {
    let c = a & r / 2, u = a & (r ^ c);
    [n, s] = k(a, n, s, c, u), r = r / 2, n += c, s += u;
  }
  return [t, n, s];
}
__name(ie, "ie");
l(ie, "tileIdToZxy");
var J = ((s) => (s[s.Unknown = 0] = "Unknown", s[s.None = 1] = "None", s[s.Gzip = 2] = "Gzip", s[s.Brotli = 3] = "Brotli", s[s.Zstd = 4] = "Zstd", s))(J || {});
function D(o, t) {
  return m(this, null, function* () {
    if (t === 1 || t === 0) return o;
    if (t === 2) {
      if (typeof globalThis.DecompressionStream == "undefined") return decompressSync(new Uint8Array(o));
      let e = new Response(o).body;
      if (!e) throw new Error("Failed to read response stream");
      let r = e.pipeThrough(new globalThis.DecompressionStream("gzip"));
      return new Response(r).arrayBuffer();
    }
    throw new Error("Compression method not supported");
  });
}
__name(D, "D");
l(D, "defaultDecompress");
var O = ((a) => (a[a.Unknown = 0] = "Unknown", a[a.Mvt = 1] = "Mvt", a[a.Png = 2] = "Png", a[a.Jpeg = 3] = "Jpeg", a[a.Webp = 4] = "Webp", a[a.Avif = 5] = "Avif", a[a.Mlt = 6] = "Mlt", a))(O || {});
function _(o) {
  return o === 1 ? ".mvt" : o === 2 ? ".png" : o === 3 ? ".jpg" : o === 4 ? ".webp" : o === 5 ? ".avif" : o === 6 ? ".mlt" : "";
}
__name(_, "_");
l(_, "tileTypeExt");
var Y = 127;
function Q(o, t) {
  let e = 0, r = o.length - 1;
  for (; e <= r; ) {
    let n = r + e >> 1, s = t - o[n].tileId;
    if (s > 0) e = n + 1;
    else if (s < 0) r = n - 1;
    else return o[n];
  }
  return r >= 0 && (o[r].runLength === 0 || t - o[r].tileId < o[r].runLength) ? o[r] : null;
}
__name(Q, "Q");
l(Q, "findTile");
var A = class A2 {
  static {
    __name(this, "A");
  }
  constructor(t) {
    this.file = t;
  }
  getKey() {
    return this.file.name;
  }
  getBytes(t, e) {
    return m(this, null, function* () {
      return { data: yield this.file.slice(t, t + e).arrayBuffer() };
    });
  }
};
l(A, "FileSource");
var C = class C2 {
  static {
    __name(this, "C");
  }
  constructor(t, e = new Headers()) {
    var i, a;
    this.url = t, this.customHeaders = e, this.mustReload = false;
    let r = "";
    "navigator" in globalThis && (r = (a = (i = globalThis.navigator) == null ? void 0 : i.userAgent) != null ? a : "");
    let n = r.indexOf("Windows") > -1, s = /Chrome|Chromium|Edg|OPR|Brave/.test(r);
    this.chromeWindowsNoCache = false, n && s && (this.chromeWindowsNoCache = true);
  }
  getKey() {
    return this.url;
  }
  setHeaders(t) {
    this.customHeaders = t;
  }
  getBytes(t, e, r, n) {
    return m(this, null, function* () {
      let s, i;
      r ? i = r : (s = new AbortController(), i = s.signal);
      let a = new Headers(this.customHeaders);
      a.set("range", `bytes=${t}-${t + e - 1}`);
      let c;
      this.mustReload ? c = "reload" : this.chromeWindowsNoCache && (c = "no-store");
      let u = yield fetch(this.url, { signal: i, cache: c, headers: a });
      if (t === 0 && u.status === 416) {
        let y = u.headers.get("Content-Range");
        if (!y || !y.startsWith("bytes */")) throw new Error("Missing content-length on 416 response");
        let f = +y.substr(8);
        u = yield fetch(this.url, { signal: i, cache: "reload", headers: { range: `bytes=0-${f - 1}` } });
      }
      let d = u.headers.get("Etag");
      if (d != null && d.startsWith("W/") && (d = null), u.status === 416 || n && d && d !== n) throw this.mustReload = true, new v(`Server returned non-matching ETag ${n} after one retry. Check browser extensions and servers for issues that may affect correct ETag headers.`);
      if (u.status >= 300) throw new Error(`Bad response code: ${u.status}`);
      let h = u.headers.get("Content-Length");
      if (u.status === 200 && (!h || +h > e)) throw s && s.abort(), new Error("Server returned no content-length header or content-length exceeding request. Check that your storage backend supports HTTP Byte Serving.");
      return { data: yield u.arrayBuffer(), etag: d || void 0, cacheControl: u.headers.get("Cache-Control") || void 0, expires: u.headers.get("Expires") || void 0 };
    });
  }
};
l(C, "FetchSource");
var T = C;
function g(o, t) {
  let e = o.getUint32(t + 4, true), r = o.getUint32(t + 0, true);
  return e * B(2, 32) + r;
}
__name(g, "g");
l(g, "getUint64");
function X(o, t) {
  let e = new DataView(o), r = e.getUint8(7);
  if (r > 3) throw new Error(`Archive is spec version ${r} but this library supports up to spec version 3`);
  return { specVersion: r, rootDirectoryOffset: g(e, 8), rootDirectoryLength: g(e, 16), jsonMetadataOffset: g(e, 24), jsonMetadataLength: g(e, 32), leafDirectoryOffset: g(e, 40), leafDirectoryLength: g(e, 48), tileDataOffset: g(e, 56), tileDataLength: g(e, 64), numAddressedTiles: g(e, 72), numTileEntries: g(e, 80), numTileContents: g(e, 88), clustered: e.getUint8(96) === 1, internalCompression: e.getUint8(97), tileCompression: e.getUint8(98), tileType: e.getUint8(99), minZoom: e.getUint8(100), maxZoom: e.getUint8(101), minLon: e.getInt32(102, true) / 1e7, minLat: e.getInt32(106, true) / 1e7, maxLon: e.getInt32(110, true) / 1e7, maxLat: e.getInt32(114, true) / 1e7, centerZoom: e.getUint8(118), centerLon: e.getInt32(119, true) / 1e7, centerLat: e.getInt32(123, true) / 1e7, etag: t };
}
__name(X, "X");
l(X, "bytesToHeader");
function Z(o) {
  let t = { buf: new Uint8Array(o), pos: 0 }, e = x(t), r = [], n = 0;
  for (let s = 0; s < e; s++) {
    let i = x(t);
    r.push({ tileId: n + i, offset: 0, length: 0, runLength: 1 }), n += i;
  }
  for (let s = 0; s < e; s++) r[s].runLength = x(t);
  for (let s = 0; s < e; s++) r[s].length = x(t);
  for (let s = 0; s < e; s++) {
    let i = x(t);
    i === 0 && s > 0 ? r[s].offset = r[s - 1].offset + r[s - 1].length : r[s].offset = i - 1;
  }
  return r;
}
__name(Z, "Z");
l(Z, "deserializeIndex");
var U = class U2 extends Error {
  static {
    __name(this, "U");
  }
};
l(U, "EtagMismatch");
var v = U;
function I(o, t) {
  return m(this, null, function* () {
    let e = yield o.getBytes(0, 16384);
    if (new DataView(e.data).getUint16(0, true) !== 19792) throw new Error("Wrong magic number for PMTiles archive");
    let n = e.data.slice(0, Y), s = X(n, e.etag), i = e.data.slice(s.rootDirectoryOffset, s.rootDirectoryOffset + s.rootDirectoryLength), a = `${o.getKey()}|${s.etag || ""}|${s.rootDirectoryOffset}|${s.rootDirectoryLength}`, c = Z(yield t(i, s.internalCompression));
    return [s, [a, c.length, c]];
  });
}
__name(I, "I");
l(I, "getHeaderAndRoot");
function K(o, t, e, r, n) {
  return m(this, null, function* () {
    let s = yield o.getBytes(e, r, void 0, n.etag), i = yield t(s.data, n.internalCompression), a = Z(i);
    if (a.length === 0) throw new Error("Empty directory is invalid");
    return a;
  });
}
__name(K, "K");
l(K, "getDirectory");
var R = class R2 {
  static {
    __name(this, "R");
  }
  constructor(t = 100, e = true, r = D) {
    this.cache = /* @__PURE__ */ new Map(), this.maxCacheEntries = t, this.counter = 1, this.decompress = r;
  }
  getHeader(t) {
    return m(this, null, function* () {
      let e = t.getKey(), r = this.cache.get(e);
      if (r) return r.lastUsed = this.counter++, r.data;
      let n = yield I(t, this.decompress);
      return n[1] && this.cache.set(n[1][0], { lastUsed: this.counter++, data: n[1][2] }), this.cache.set(e, { lastUsed: this.counter++, data: n[0] }), this.prune(), n[0];
    });
  }
  getDirectory(t, e, r, n) {
    return m(this, null, function* () {
      let s = `${t.getKey()}|${n.etag || ""}|${e}|${r}`, i = this.cache.get(s);
      if (i) return i.lastUsed = this.counter++, i.data;
      let a = yield K(t, this.decompress, e, r, n);
      return this.cache.set(s, { lastUsed: this.counter++, data: a }), this.prune(), a;
    });
  }
  prune() {
    if (this.cache.size > this.maxCacheEntries) {
      let t = 1 / 0, e;
      this.cache.forEach((r, n) => {
        r.lastUsed < t && (t = r.lastUsed, e = n);
      }), e && this.cache.delete(e);
    }
  }
  invalidate(t) {
    return m(this, null, function* () {
      this.cache.delete(t.getKey());
    });
  }
};
l(R, "ResolvedValueCache");
var $ = R;
var M = class M2 {
  static {
    __name(this, "M");
  }
  constructor(t = 100, e = true, r = D) {
    this.cache = /* @__PURE__ */ new Map(), this.invalidations = /* @__PURE__ */ new Map(), this.maxCacheEntries = t, this.counter = 1, this.decompress = r;
  }
  getHeader(t) {
    return m(this, null, function* () {
      let e = t.getKey(), r = this.cache.get(e);
      if (r) return r.lastUsed = this.counter++, yield r.data;
      let n = new Promise((s, i) => {
        I(t, this.decompress).then((a) => {
          a[1] && this.cache.set(a[1][0], { lastUsed: this.counter++, data: Promise.resolve(a[1][2]) }), s(a[0]), this.prune();
        }).catch((a) => {
          i(a);
        });
      });
      return this.cache.set(e, { lastUsed: this.counter++, data: n }), n;
    });
  }
  getDirectory(t, e, r, n) {
    return m(this, null, function* () {
      let s = `${t.getKey()}|${n.etag || ""}|${e}|${r}`, i = this.cache.get(s);
      if (i) return i.lastUsed = this.counter++, yield i.data;
      let a = new Promise((c, u) => {
        K(t, this.decompress, e, r, n).then((d) => {
          c(d), this.prune();
        }).catch((d) => {
          u(d);
        });
      });
      return this.cache.set(s, { lastUsed: this.counter++, data: a }), a;
    });
  }
  prune() {
    if (this.cache.size >= this.maxCacheEntries) {
      let t = 1 / 0, e;
      this.cache.forEach((r, n) => {
        r.lastUsed < t && (t = r.lastUsed, e = n);
      }), e && this.cache.delete(e);
    }
  }
  invalidate(t) {
    return m(this, null, function* () {
      let e = t.getKey();
      if (this.invalidations.get(e)) return yield this.invalidations.get(e);
      this.cache.delete(t.getKey());
      let r = new Promise((n, s) => {
        this.getHeader(t).then((i) => {
          n(), this.invalidations.delete(e);
        }).catch((i) => {
          s(i);
        });
      });
      this.invalidations.set(e, r);
    });
  }
};
l(M, "SharedPromiseCache");
var P = M;
var H = class H2 {
  static {
    __name(this, "H");
  }
  constructor(t, e, r) {
    typeof t == "string" ? this.source = new T(t) : this.source = t, r ? this.decompress = r : this.decompress = D, e ? this.cache = e : this.cache = new P();
  }
  getHeader() {
    return m(this, null, function* () {
      return yield this.cache.getHeader(this.source);
    });
  }
  getZxyAttempt(t, e, r, n) {
    return m(this, null, function* () {
      let s = q(t, e, r), i = yield this.cache.getHeader(this.source);
      if (t < i.minZoom || t > i.maxZoom) return;
      let a = i.rootDirectoryOffset, c = i.rootDirectoryLength;
      for (let u = 0; u <= 3; u++) {
        let d = yield this.cache.getDirectory(this.source, a, c, i), h = Q(d, s);
        if (h) {
          if (h.runLength > 0) {
            let p = yield this.source.getBytes(i.tileDataOffset + h.offset, h.length, n, i.etag);
            return { data: yield this.decompress(p.data, i.tileCompression), cacheControl: p.cacheControl, expires: p.expires };
          }
          a = i.leafDirectoryOffset + h.offset, c = h.length;
        } else return;
      }
      throw new Error("Maximum directory depth exceeded");
    });
  }
  getZxy(t, e, r, n) {
    return m(this, null, function* () {
      try {
        return yield this.getZxyAttempt(t, e, r, n);
      } catch (s) {
        if (s instanceof v) return this.cache.invalidate(this.source), yield this.getZxyAttempt(t, e, r, n);
        throw s;
      }
    });
  }
  getMetadataAttempt() {
    return m(this, null, function* () {
      let t = yield this.cache.getHeader(this.source), e = yield this.source.getBytes(t.jsonMetadataOffset, t.jsonMetadataLength, void 0, t.etag), r = yield this.decompress(e.data, t.internalCompression), n = new TextDecoder("utf-8");
      return JSON.parse(n.decode(r));
    });
  }
  getMetadata() {
    return m(this, null, function* () {
      try {
        return yield this.getMetadataAttempt();
      } catch (t) {
        if (t instanceof v) return this.cache.invalidate(this.source), yield this.getMetadataAttempt();
        throw t;
      }
    });
  }
  getTileJson(t) {
    return m(this, null, function* () {
      let e = yield this.getHeader(), r = yield this.getMetadata(), n = _(e.tileType);
      return { tilejson: "3.0.0", scheme: "xyz", tiles: [`${t}/{z}/{x}/{y}${n}`], vector_layers: r.vector_layers, attribution: r.attribution, description: r.description, name: r.name, version: r.version, bounds: [e.minLon, e.minLat, e.maxLon, e.maxLat], center: [e.centerLon, e.centerLat, e.centerZoom], minzoom: e.minZoom, maxzoom: e.maxZoom };
    });
  }
};
l(H, "PMTiles");
var w = H;

// src/index.ts
async function nativeDecompress(buf, compression) {
  if (compression === 0 || compression === 0) return buf;
  if (compression === 2) {
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(buf);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      if (result.done) {
        done = true;
      } else {
        chunks.push(new Uint8Array(result.value));
      }
    }
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged.buffer;
  }
  throw new Error(`Unsupported compression: ${compression}`);
}
__name(nativeDecompress, "nativeDecompress");
var R2Source = class {
  static {
    __name(this, "R2Source");
  }
  bucket;
  key;
  constructor(bucket, key) {
    this.bucket = bucket;
    this.key = key;
  }
  getKey() {
    return this.key;
  }
  async getBytes(offset, length, signal, etag) {
    const obj = await this.bucket.get(this.key, {
      range: { offset, length }
    });
    if (!obj) {
      throw new Error(`R2 object not found: ${this.key}`);
    }
    const body = obj;
    const data = await body.arrayBuffer();
    return {
      data,
      etag: obj.etag,
      cacheControl: obj.httpMetadata?.cacheControl
    };
  }
};
function tileTypeToContentType(t) {
  switch (t) {
    case O.Mvt:
      return "application/x-protobuf";
    case O.Png:
      return "image/png";
    case O.Jpeg:
      return "image/jpeg";
    case O.Webp:
      return "image/webp";
    case O.Avif:
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}
__name(tileTypeToContentType, "tileTypeToContentType");
function staticContentType(key) {
  if (key.endsWith(".pbf")) return "application/x-protobuf";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".json")) return "application/json";
  if (key.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}
__name(staticContentType, "staticContentType");
function corsHeaders(origin, allowedOrigins) {
  const headers = new Headers();
  if (allowedOrigins === "*" || allowedOrigins.split(",").includes(origin)) {
    headers.set(
      "Access-Control-Allow-Origin",
      allowedOrigins === "*" ? "*" : origin
    );
  }
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Range, If-Match, If-None-Match"
  );
  headers.set("Access-Control-Expose-Headers", "ETag");
  return headers;
}
__name(corsHeaders, "corsHeaders");
var CACHE = new $(100, void 0, nativeDecompress);
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS);
    if (request.method === "OPTIONS") {
      cors.set("Access-Control-Max-Age", "86400");
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: cors
      });
    }

    // Cloudflare Cache API — check edge cache before hitting R2
    const cfCache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cachedResponse = await cfCache.match(cacheKey);
    if (cachedResponse) {
      const response = new Response(cachedResponse.body, cachedResponse);
      // Re-apply CORS headers (vary by origin, not stored in cache)
      for (const [k, v] of cors.entries()) {
        response.headers.set(k, v);
      }
      return response;
    }

    // --- Origin fetch (R2) ---
    const path = url.pathname;
    let response;

    if (path.startsWith("/fonts/") || path.startsWith("/sprites/")) {
      const key = decodeURIComponent(path.slice(1));
      const obj = await env.BUCKET.get(key);
      if (!obj) {
        return new Response("Not found", { status: 404, headers: cors });
      }
      const headers = new Headers(cors);
      headers.set("Content-Type", staticContentType(key));
      headers.set("Cache-Control", "public, max-age=604800");
      headers.set("ETag", obj.etag);
      response = new Response(obj.body, { status: 200, headers });
    } else if ((tileMatch = path.match(
      /^\/([^/]+)\/(\d+)\/(\d+)\/(\d+)\.(mvt|pbf|png|jpg|jpeg|webp|avif)$/
    ))) {
      var tileMatch;
      const [, name, zStr, xStr, yStr] = tileMatch;
      const z = parseInt(zStr, 10);
      const x2 = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      const pmtilesKey = `${name}.pmtiles`;
      const source = new R2Source(env.BUCKET, pmtilesKey);
      const pmtiles = new w(source, CACHE, nativeDecompress);
      const header = await pmtiles.getHeader();
      const tile = await pmtiles.getZxy(z, x2, y);
      if (!tile || !tile.data) {
        return new Response("Tile not found", {
          status: 404,
          headers: cors
        });
      }
      const headers = new Headers(cors);
      headers.set("Content-Type", tileTypeToContentType(header.tileType));
      headers.set("Cache-Control", "public, max-age=86400");
      response = new Response(tile.data, { status: 200, headers });
    } else if ((jsonMatch = path.match(/^\/([^/]+)\.json$/))) {
      var jsonMatch;
      const name = jsonMatch[1];
      const pmtilesKey = `${name}.pmtiles`;
      const source = new R2Source(env.BUCKET, pmtilesKey);
      const pmtiles = new w(source, CACHE, nativeDecompress);
      const header = await pmtiles.getHeader();
      const metadata = await pmtiles.getMetadata();
      const tileJson = {
        tilejson: "3.0.0",
        name,
        scheme: "xyz",
        tiles: [`${url.origin}/${name}/{z}/{x}/{y}.mvt`],
        minzoom: header.minZoom,
        maxzoom: header.maxZoom,
        bounds: [
          header.minLon,
          header.minLat,
          header.maxLon,
          header.maxLat
        ],
        center: [header.centerLon, header.centerLat, header.centerZoom],
        ...typeof metadata === "object" ? metadata : {}
      };
      const headers = new Headers(cors);
      headers.set("Content-Type", "application/json");
      headers.set("Cache-Control", "public, max-age=86400");
      response = new Response(JSON.stringify(tileJson, null, 2), {
        status: 200,
        headers
      });
    } else {
      return new Response(
        "Not found. Routes: /{name}/{z}/{x}/{y}.mvt, /{name}.json, /fonts/*, /sprites/*",
        { status: 404, headers: cors }
      );
    }

    // Store in Cloudflare edge cache (non-blocking)
    ctx.waitUntil(cfCache.put(cacheKey, response.clone()));
    return response;
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
