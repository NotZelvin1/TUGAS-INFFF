/* Dimuat di <head> sebelum halaman digambar, supaya tema tersimpan langsung
   dipakai dan layar tidak berkedip. */
(function () {
  try {
    var t = localStorage.getItem("tema");
    if (t !== "gelap" && t !== "terang") t = matchMedia("(prefers-color-scheme: dark)").matches ? "gelap" : "terang";
    document.documentElement.dataset.tema = t;
  } catch (e) {}
})();
