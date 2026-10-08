/*
 * Paylaşım sitesi — kişi sayfasının tarayıcı kodu.
 * `npm run paylasim` bu dosyayı paylasim-sitesi/ köküne kopyalar.
 *
 * Bağımlılık yok, derleme yok: düz tarayıcı JavaScript'i. Sayfadaki
 * <script id="veri"> kişinin eksen profilini taşır.
 */
(function () {
  "use strict";

  var veri = JSON.parse(document.getElementById("veri").textContent);

  /** Küçük DOM yardımcısı: metin her zaman textContent ile (HTML enjeksiyonu yok). */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /* ---------- 1. Ziyaretçinin profili (?p) ---------- */

  // share-code.ts decodeProfile ile aynı biçim: eksen başına 2 karakter, 36'lık taban.
  function decode(code, n) {
    if (!code || code.length !== n * 2 || !/^[0-9a-z]+$/.test(code)) return null;
    var out = [];
    for (var i = 0; i < n; i++) {
      var v = parseInt(code.slice(i * 2, i * 2 + 2), 36);
      if (isNaN(v) || v < 0 || v > 100) return null;
      out.push(v);
    }
    return out;
  }

  // engine.ts pearson + toCompatibility ile birebir aynı hesap: telefondaki
  // uyum yüzdesi stanttaki ekranla aynı çıkmalı.
  function pearson(a, b) {
    var n = a.length;
    var ma = 0;
    var mb = 0;
    for (var i = 0; i < n; i++) {
      ma += a[i];
      mb += b[i];
    }
    ma /= n;
    mb /= n;
    var num = 0;
    var da = 0;
    var db = 0;
    for (var j = 0; j < n; j++) {
      num += (a[j] - ma) * (b[j] - mb);
      da += (a[j] - ma) * (a[j] - ma);
      db += (b[j] - mb) * (b[j] - mb);
    }
    var den = Math.sqrt(da * db);
    return den === 0 ? 0 : num / den;
  }
  function compatibility(r) {
    return Math.min(99, Math.max(41, Math.round(55 + 45 * r)));
  }

  var user = decode(new URLSearchParams(location.search).get("p"), veri.axes.length);
  if (user) {
    // Uyum halkası (portrenin köşesi) — uygulamadaki compat-ring.tsx ile aynı.
    var yuzde = compatibility(pearson(user, veri.profile) * veri.weight);
    document.getElementById("uyum").textContent = "%" + yuzde;
    document.getElementById("halka").hidden = false;
    var dolu = document.getElementById("halka-dolu");
    var cevre = 2 * Math.PI * 40; // r=40, build.tsx portraitHtml ile aynı
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        dolu.style.strokeDashoffset = String(cevre * (1 - yuzde / 100));
      });
    });

    // your-profile.tsx ile aynı görüntüleme ölçeği: tepe eksen %100.
    var peak = Math.max.apply(null, user.concat([1]));
    var pcts = user.map(function (v) {
      return Math.round((v / peak) * 100);
    });
    // En güçlü iki eksen rozet alır — engine.ts dominantAxes ile aynı kural:
    // yuvarlanmamış değere göre azalan, eşitlikte eksen sırası (sort kararlı).
    var top2 = user
      .map(function (v, i) {
        return { p: v, i: i };
      })
      .sort(function (a, b) {
        return b.p - a.p;
      })
      .slice(0, 2)
      .map(function (x) {
        return x.i;
      });

    var box = document.getElementById("cubuklar");
    var fills = [];
    veri.axes.forEach(function (axis, i) {
      var row = el("div", "cubuk" + (top2.indexOf(i) >= 0 ? " tepe" : ""));
      row.style.setProperty("--renk", axis.color);

      var head = el("div", "cubuk-ust");
      var ikon = el("span", "ikon");
      ikon.setAttribute("aria-hidden", "true");
      // axis.icon: build.tsx'in derlemede ürettiği SVG (ui/glyph.tsx) — kullanıcı
      // girdisi değil, sitenin kendi çıktısı; bu yüzden innerHTML güvenli.
      ikon.innerHTML = axis.icon;
      head.appendChild(ikon);
      head.appendChild(el("span", "ad", axis.label));
      if (top2.indexOf(i) >= 0) head.appendChild(el("span", "rozet-tepe", "en güçlü"));
      head.appendChild(el("span", "deger", String(pcts[i])));

      var track = el("div", "iz");
      var fill = el("div", "dolgu");
      track.appendChild(fill);
      fills.push({ node: fill, pct: pcts[i], i: i });

      row.appendChild(head);
      row.appendChild(track);
      box.appendChild(row);
    });
    document.getElementById("profil").hidden = false;

    // Çubuklar 0'dan dolarak açılır (CSS geçişi; hareket azaltma tercihinde anında).
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        fills.forEach(function (f) {
          f.node.style.transitionDelay = f.i * 70 + "ms";
          f.node.style.width = Math.max(f.pct, 3) + "%";
        });
      });
    });
  }

  /* ---------- 2. Şablon seçimi ve hikâyende paylaş ---------- */

  // Kaydırılabilir şablonlar (build.tsx STORY_TEMPLATES). Hangisi ortadaysa
  // "paylaş" ve "kaydet" onu kullanır.
  var kutu = document.getElementById("sablonlar");
  var sablonlar = Array.prototype.slice.call(kutu.querySelectorAll(".sablon"));
  var noktalar = Array.prototype.slice.call(document.querySelectorAll("#noktalar .nokta"));
  var ipucu = document.getElementById("ipucu");
  var kaydet = document.getElementById("kaydet");
  var secili = 0;

  // Dosyalar SAYFA AÇILIRKEN hazırlanır: Safari, navigator.share'i yalnızca
  // dokunuşun hemen ardından kabul eder. Dokunuştan sonra fetch beklenirse
  // izin düşer ve paylaşım menüsü açılmaz. İki şablon da baştan indirilir.
  var dosyalar = sablonlar.map(function () {
    return null;
  });
  sablonlar.forEach(function (s, i) {
    var ad = s.getAttribute("data-dosya");
    fetch(ad)
      .then(function (res) {
        return res.blob();
      })
      .then(function (blob) {
        dosyalar[i] = new File([blob], veri.slug + "-" + ad, { type: "image/png" });
      })
      .catch(function () {
        /* görsel alınamazsa düğme kaydetmeye düşer */
      });
  });

  function sec(i) {
    secili = i;
    noktalar.forEach(function (n, j) {
      n.classList.toggle("aktif", j === i);
      n.setAttribute("aria-current", j === i ? "true" : "false");
    });
    var ad = sablonlar[i].getAttribute("data-dosya");
    kaydet.setAttribute("href", ad);
    kaydet.setAttribute("download", veri.slug + "-" + ad);
  }

  // Kaydırma bitince ortadaki şablonu seç (scroll-snap; kütüphane yok).
  var bekle = null;
  kutu.addEventListener("scroll", function () {
    clearTimeout(bekle);
    bekle = setTimeout(function () {
      var orta = kutu.scrollLeft + kutu.clientWidth / 2;
      var en = 0;
      var fark = Infinity;
      sablonlar.forEach(function (s, i) {
        var d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - orta);
        if (d < fark) {
          fark = d;
          en = i;
        }
      });
      if (en !== secili) sec(en);
    }, 80);
  });
  noktalar.forEach(function (n, i) {
    n.addEventListener("click", function () {
      var s = sablonlar[i];
      kutu.scrollTo({ left: s.offsetLeft - (kutu.clientWidth - s.offsetWidth) / 2, behavior: "smooth" });
      sec(i);
    });
  });

  document.getElementById("paylas-btn").addEventListener("click", function () {
    var file = dosyalar[secili];
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      // Yalnızca dosya: metin eklenirse bazı Android hedefleri görseli düşürüyor.
      navigator.share({ files: [file] }).catch(function (err) {
        if (err && err.name === "AbortError") return; // kullanıcı vazgeçti
        kaydet.click();
        ipucu.hidden = false;
      });
      return;
    }
    // Dosya paylaşımı yoksa (çoğunlukla masaüstü): indir ve yolu göster.
    kaydet.click();
    ipucu.hidden = false;
  });

  kaydet.addEventListener("click", function () {
    ipucu.hidden = false;
  });

  /* ---------- 3. Bağlantı çıkartması için linki kopyala ---------- */

  // Instagram'ın bağlantı çıkartmasına yapıştırılır; hikâyeyi gören arkadaş
  // dokunup teste gider. Pano izni yoksa link seçilebilir metin olarak çıkar.
  var kopyala = document.getElementById("link-kopyala");
  var yedek = document.getElementById("link-yedek");
  function kopyalandi(ok) {
    if (ok) {
      kopyala.textContent = "Kopyalandı ✓";
      kopyala.classList.add("tamam");
      setTimeout(function () {
        kopyala.textContent = "Kopyala";
        kopyala.classList.remove("tamam");
      }, 2200);
    } else {
      yedek.hidden = false;
    }
  }
  kopyala.addEventListener("click", function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(veri.link).then(
        function () {
          kopyalandi(true);
        },
        function () {
          kopyalandi(false);
        },
      );
      return;
    }
    kopyalandi(false);
  });
})();
