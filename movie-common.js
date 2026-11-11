const API_KEY = "ca6f3a5bb2be97f2e5decc36839e584f";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";
const API_MOVIE = "https://api.themoviedb.org/3/movie";

const REGIONS = [
  { code: "KR", label: "한국", labelEn: "Korea" },
  { code: "US", label: "미국", labelEn: "USA" },
  { code: "JP", label: "일본", labelEn: "Japan" },
];

function setCountryHeading(el, regionConfig) {
  el.replaceChildren();
  el.append(`${regionConfig.label} `);
  const en = document.createElement("span");
  en.className = "movie-row__country-en";
  en.textContent = `(${regionConfig.labelEn})`;
  el.appendChild(en);
}

const OTT_PROVIDERS = [
  { id: 8, label: "넷플릭스" },
  { id: 356, label: "웨이브" },
  { id: 97, label: "왓챠" },
  { id: 464, label: "티빙" },
  { id: 337, label: "디즈니+" },
  { id: 119, label: "프라임 비디오" },
  { id: 350, label: "Apple TV" },
];

/** 검색 URL 바로가기 불가 (로그인 필요 등) */
const OTT_NO_WATCH_LINK = new Set([8, 337]);

const OTT_WATCH_NOTES = {
  8: "넷플릭스는 로그인 후 앱·웹에서 직접 검색해 주세요.",
  337: "디즈니+는 로그인 후 앱·웹에서 직접 검색해 주세요.",
};

const OTT_SEARCH_URL_BUILDERS = {
  97: (q) => `https://watcha.com/search?query=${q}`,
  119: (q) =>
    `https://www.primevideo.com/-/ko/search?ie=UTF8&ref_=atv_nb_sug&phrase=${q}`,
  337: (q) => `https://www.disneyplus.com/search/${q}`,
  350: (q) => `https://tv.apple.com/kr/search?term=${q}`,
  356: (q) => `https://www.wavve.com/search?searchWord=${q}`,
  464: (q) => `https://www.tving.com/search?keyword=${q}`,
  115: (q) => `https://www.tving.com/search?keyword=${q}`,
};

const headerEl = document.querySelector(".site-header");
const modalEl = document.getElementById("movie-modal");
const modalLoadingEl = document.getElementById("modal-loading");
const modalContentEl = document.getElementById("modal-content");
const modalTitleEl = document.getElementById("modal-title");
const modalReleaseEl = document.getElementById("modal-release");
const modalGenresEl = document.getElementById("modal-genres");
const modalCertificationEl = document.getElementById("modal-certification");
const modalRatingEl = document.getElementById("modal-rating");
const modalWatchEl = document.getElementById("modal-watch");
const modalOverviewEl = document.getElementById("modal-overview");

function createPosterElement(movie) {
  if (movie.poster_path) {
    const img = document.createElement("img");
    img.className = "movie-card__poster";
    img.src = `${POSTER_BASE}${movie.poster_path}`;
    img.alt = `${movie.title} 포스터`;
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = () => {
      img.replaceWith(createPlaceholder(movie.title));
    };
    return img;
  }
  return createPlaceholder(movie.title);
}

function createPlaceholder(title) {
  const div = document.createElement("div");
  div.className = "movie-card__poster movie-card__poster--placeholder";
  div.setAttribute("role", "img");
  div.setAttribute("aria-label", "포스터 없음");
  div.textContent = title;
  return div;
}

function getOttProvider(providerId) {
  return OTT_PROVIDERS.find((p) => p.id === providerId) ?? null;
}

function getOttProviderLabel(providerId) {
  return getOttProvider(providerId)?.label ?? "OTT";
}

function ottSearchUrl(providerId, providerName, movieTitle) {
  if (OTT_NO_WATCH_LINK.has(providerId)) return null;

  const q = encodeURIComponent(movieTitle);
  const build = OTT_SEARCH_URL_BUILDERS[providerId];
  if (build) return build(q);

  const name = (providerName || "").toLowerCase();
  if (name.includes("netflix") || name.includes("넷플릭스")) {
    return null;
  }
  if (name.includes("wavve") || name.includes("웨이브")) {
    return OTT_SEARCH_URL_BUILDERS[356](q);
  }
  if (name.includes("watcha") || name.includes("왓챠")) {
    return OTT_SEARCH_URL_BUILDERS[97](q);
  }
  if (name.includes("disney") || name.includes("디즈니")) {
    return null;
  }
  if (name.includes("tving") || name.includes("티빙")) {
    return OTT_SEARCH_URL_BUILDERS[464](q);
  }
  if (name.includes("apple") || name.includes("애플")) {
    return OTT_SEARCH_URL_BUILDERS[350](q);
  }
  if (name.includes("prime") || name.includes("아마존")) {
    return OTT_SEARCH_URL_BUILDERS[119](q);
  }

  return null;
}

function renderSelectedOttWatch(movieTitle, providerId) {
  if (!modalWatchEl) return;
  modalWatchEl.replaceChildren();

  if (!providerId) {
    modalWatchEl.textContent = "—";
    return;
  }

  const label = getOttProviderLabel(providerId);

  if (OTT_NO_WATCH_LINK.has(providerId)) {
    const note = document.createElement("span");
    note.className = "modal__watch-note";
    note.textContent =
      OTT_WATCH_NOTES[providerId] ?? "로그인 후 앱·웹에서 직접 검색해 주세요.";
    modalWatchEl.appendChild(note);
    return;
  }

  const url = ottSearchUrl(providerId, label, movieTitle);

  if (!url) {
    modalWatchEl.textContent = "검색 링크를 만들 수 없습니다.";
    return;
  }

  const link = document.createElement("a");
  link.className = "modal__watch-link";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = `${label}에서 «${movieTitle}» 검색`;
  link.setAttribute("aria-label", `${label}에서 ${movieTitle} 검색`);
  link.textContent = label;
  modalWatchEl.appendChild(link);
}

function createMovieCard(movie, rank, regionCode, modalOptions = {}) {
  const card = document.createElement("article");
  card.className = "movie-card";
  card.setAttribute("role", "listitem");

  const rankEl = document.createElement("span");
  rankEl.className = "movie-card__rank";
  rankEl.textContent = String(rank);
  rankEl.setAttribute("aria-label", `${rank}위`);

  const body = document.createElement("div");
  body.className = "movie-card__body";

  const posterWrap = document.createElement("button");
  posterWrap.type = "button";
  posterWrap.className = "movie-card__poster-wrap";
  posterWrap.setAttribute("aria-label", `${movie.title} 상세 정보`);
  posterWrap.appendChild(createPosterElement(movie));
  posterWrap.addEventListener("click", () =>
    openMovieModal(movie, regionCode, modalOptions)
  );

  const title = document.createElement("h4");
  title.className = "movie-card__title";
  title.textContent = movie.title;

  body.append(posterWrap, title);
  card.append(rankEl, body);
  return card;
}

function createSimpleMovieRow(regionConfig, movies, listLabel, modalOptions = {}) {
  const row = document.createElement("section");
  row.className = "movie-row";

  const country = document.createElement("h3");
  country.className = "movie-row__country";
  setCountryHeading(country, regionConfig);

  const slider = document.createElement("div");
  slider.className = "movie-row__slider movie-row__slider--static";

  const grid = document.createElement("div");
  grid.className = "movie-row__grid";
  grid.setAttribute("role", "list");
  grid.setAttribute(
    "aria-label",
    `${regionConfig.label} ${listLabel}`
  );

  movies.slice(0, 6).forEach((movie, index) => {
    grid.appendChild(
      createMovieCard(movie, index + 1, regionConfig.code, modalOptions)
    );
  });

  slider.appendChild(grid);
  row.append(country, slider);
  return row;
}

function movieDetailUrl(movieId) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    language: "ko-KR",
  });
  return `${API_MOVIE}/${movieId}?${params}`;
}

function movieReleaseDatesUrl(movieId) {
  const params = new URLSearchParams({ api_key: API_KEY });
  return `${API_MOVIE}/${movieId}/release_dates?${params}`;
}

function formatGenres(genres) {
  if (!genres?.length) return "—";
  return genres.map((g) => g.name).join(" · ");
}

const US_CERT_TO_AGE = {
  G: "전체 관람가",
  PG: "7세 이상",
  "PG-13": "13세 이상",
  R: "17세 이상",
  "NC-17": "19세 이상",
  "NC-21": "19세 이상",
};

const JP_CERT_TO_AGE = {
  G: "전체 관람가",
  PG12: "12세 이상",
  "R15+": "15세 이상",
  "R18+": "19세 이상",
};

function formatCertLabel(cert, regionCode) {
  const raw = cert.trim();
  if (!raw) return null;

  if (raw === "0" || raw === "전체" || raw.toUpperCase() === "ALL") {
    return "전체 관람가";
  }

  if (/^\d+$/.test(raw)) {
    return `${raw}세 이상`;
  }

  const normalized = raw.replace(/\s+/g, "").toUpperCase();

  if (regionCode === "US") {
    const usKey = Object.keys(US_CERT_TO_AGE).find(
      (key) => key.toUpperCase() === normalized || key === raw
    );
    if (usKey) return US_CERT_TO_AGE[usKey];
    if (US_CERT_TO_AGE[raw]) return US_CERT_TO_AGE[raw];
  }

  if (regionCode === "JP") {
    const jpCompact = raw.replace(/\s+/g, "");
    if (JP_CERT_TO_AGE[jpCompact]) return JP_CERT_TO_AGE[jpCompact];

    const jpPg = jpCompact.match(/^PG(\d{1,2})$/i);
    if (jpPg) return `${jpPg[1]}세 이상`;

    const jpR = jpCompact.match(/^R?(\d{1,2})\+$/i);
    if (jpR) return `${jpR[1]}세 이상`;
  }

  const embeddedAge = raw.match(/(\d{1,2})\s*\+/);
  if (embeddedAge) return `${embeddedAge[1]}세 이상`;

  return raw;
}

function setCertificationText(text) {
  if (!modalCertificationEl) return;
  modalCertificationEl.textContent = text;
  const isAdult = text.includes("19세 이상");
  modalCertificationEl.classList.toggle("modal__certification--adult", isAdult);
}

function certificationForCountry(results, regionCode) {
  const country = results.find((r) => r.iso_3166_1 === regionCode);
  if (!country?.release_dates?.length) return null;

  const dated = country.release_dates
    .filter((d) => d.certification && d.certification.trim() !== "")
    .sort((a, b) => {
      const aTheatrical = a.type === 3 ? 1 : 0;
      const bTheatrical = b.type === 3 ? 1 : 0;
      return bTheatrical - aTheatrical;
    });

  const cert = dated[0]?.certification;
  return cert ? formatCertLabel(cert, regionCode) : null;
}

function resolveCertification(releaseDates, preferredRegion) {
  const results = releaseDates.results ?? [];
  const regionOrder = [preferredRegion, "KR", "US", "JP"].filter(
    (code, index, arr) => code && arr.indexOf(code) === index
  );

  for (const code of regionOrder) {
    const label = certificationForCountry(results, code);
    if (label) {
      const region = REGIONS.find((r) => r.code === code);
      if (code === preferredRegion || !region) {
        return label;
      }
      return `${label} (${region.label})`;
    }
  }

  for (const country of results) {
    const label = certificationForCountry(results, country.iso_3166_1);
    if (label) return label;
  }

  return "등급 정보 없음";
}

function formatReleaseDate(dateStr) {
  if (!dateStr) return "미정";
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatRating(voteAverage) {
  if (voteAverage == null || Number.isNaN(voteAverage)) {
    return "—";
  }
  const value = voteAverage.toFixed(1);
  return `<span class="modal__rating-value">${value}</span> / 10 (TMDB)`;
}

function setOverviewText(overview) {
  if (!modalOverviewEl) return;
  const text = overview?.trim();
  modalOverviewEl.textContent = text || "등록된 줄거리가 없습니다.";
}

function setModalBusy(busy) {
  if (!modalLoadingEl || !modalContentEl) return;
  modalLoadingEl.hidden = !busy;
  modalContentEl.hidden = busy;
}

function openMovieModal(movie, regionCode = "KR", modalOptions = {}) {
  if (!modalEl) return;
  modalEl.hidden = false;
  document.body.style.overflow = "hidden";
  modalTitleEl.textContent = movie.title;
  setModalBusy(true);

  void loadMovieModalData(movie.id, movie.title, regionCode, modalOptions);
}

function closeMovieModal() {
  if (!modalEl) return;
  modalEl.hidden = true;
  document.body.style.overflow = "";
}

async function loadMovieModalData(
  movieId,
  fallbackTitle,
  regionCode,
  modalOptions = {}
) {
  try {
    const [detailRes, releaseDatesRes] = await Promise.all([
      fetch(movieDetailUrl(movieId)),
      fetch(movieReleaseDatesUrl(movieId)),
    ]);

    if (!detailRes.ok) {
      throw new Error(`상세 정보 오류 (${detailRes.status})`);
    }

    const detail = await detailRes.json();
    const releaseDates = releaseDatesRes.ok
      ? await releaseDatesRes.json()
      : { results: [] };

    const title = detail.title || fallbackTitle;
    modalTitleEl.textContent = title;
    modalReleaseEl.textContent = formatReleaseDate(detail.release_date);
    modalGenresEl.textContent = formatGenres(detail.genres);
    setCertificationText(resolveCertification(releaseDates, regionCode));
    modalRatingEl.innerHTML = formatRating(detail.vote_average);
    renderSelectedOttWatch(title, modalOptions.providerId);
    setOverviewText(detail.overview);

    setModalBusy(false);
  } catch (err) {
    console.error(err);
    setModalBusy(false);
    modalTitleEl.textContent = fallbackTitle;
    modalReleaseEl.textContent = "—";
    modalGenresEl.textContent = "—";
    setCertificationText("—");
    modalRatingEl.textContent = "—";
    renderSelectedOttWatch(fallbackTitle, modalOptions.providerId);
    modalOverviewEl.textContent =
      "정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

function initMovieModal() {
  if (!modalEl) return;
  modalEl.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", closeMovieModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalEl.hidden) {
      closeMovieModal();
    }
  });
}

function initHeaderOnScroll() {
  if (!headerEl) return;
  const onScroll = () => {
    headerEl.classList.toggle("site-header--solid", window.scrollY > 40);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function setPageStatus(message, isError = false) {
  const statusEl = document.getElementById("status");
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle("status--error", isError);
}
