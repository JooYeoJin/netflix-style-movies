const API_NOW_PLAYING = "https://api.themoviedb.org/3/movie/now_playing";
const API_POPULAR = "https://api.themoviedb.org/3/movie/popular";
const MOVIES_VISIBLE = 6;
const MOVIES_PER_REGION = 18;

const SORT_POPULAR = "popular";
const SORT_RATING = "rating";

let currentSort = SORT_POPULAR;
const regionDataCache = new Map();
const regionCarouselPage = new Map(
  REGIONS.map((region) => [region.code, 0])
);

const rowsEl = document.getElementById("movie-rows");

function buildApiUrl(base, region, page) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    language: "ko-KR",
    region,
    page: String(page),
  });
  return `${base}?${params}`;
}

async function fetchMovieList(base, region, page = 1) {
  const res = await fetch(buildApiUrl(base, region, page));
  if (!res.ok) {
    throw new Error(`API 오류 (${res.status}) — ${region}`);
  }
  const data = await res.json();
  return data.results ?? [];
}

/** 현재 상영 목록 (18편까지, 최대 3페이지) */
async function fetchNowPlaying(region) {
  let combined = [];
  for (let page = 1; page <= 3 && combined.length < MOVIES_PER_REGION; page++) {
    const batch = await fetchMovieList(API_NOW_PLAYING, region, page);
    combined = dedupeById([...combined, ...batch]);
    if (batch.length < 20) break;
  }
  return combined;
}

function dedupeById(movies) {
  const seen = new Set();
  const out = [];
  for (const movie of movies) {
    if (seen.has(movie.id)) continue;
    seen.add(movie.id);
    out.push(movie);
  }
  return out;
}

function rankNowPlayingByPopular(nowPlaying, popular) {
  const popularOrder = new Map();
  popular.forEach((movie, index) => {
    popularOrder.set(movie.id, index);
  });

  const pool = dedupeById(nowPlaying);

  pool.sort((a, b) => {
    const aInPopular = popularOrder.has(a.id);
    const bInPopular = popularOrder.has(b.id);

    if (aInPopular && bInPopular) {
      return popularOrder.get(a.id) - popularOrder.get(b.id);
    }
    if (aInPopular) return -1;
    if (bInPopular) return 1;

    return (b.popularity ?? 0) - (a.popularity ?? 0);
  });

  return pool.slice(0, MOVIES_PER_REGION);
}

function rankNowPlayingByRating(nowPlaying) {
  const pool = dedupeById(nowPlaying);

  pool.sort((a, b) => {
    const scoreDiff = (b.vote_average ?? 0) - (a.vote_average ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.vote_count ?? 0) - (a.vote_count ?? 0);
  });

  return pool.slice(0, MOVIES_PER_REGION);
}

function getCarouselPage(regionCode) {
  return regionCarouselPage.get(regionCode) ?? 0;
}

function maxCarouselPage(movieCount) {
  return Math.max(0, Math.ceil(movieCount / MOVIES_VISIBLE) - 1);
}

function fillMovieGrid(grid, movies, page, regionCode) {
  grid.replaceChildren();
  const start = page * MOVIES_VISIBLE;
  const slice = movies.slice(start, start + MOVIES_VISIBLE);

  slice.forEach((movie, index) => {
    grid.appendChild(createMovieCard(movie, start + index + 1, regionCode));
  });
}

function updateRowNav(prevBtn, nextBtn, page, movieCount) {
  const lastPage = maxCarouselPage(movieCount);
  const hasPages = lastPage > 0;

  prevBtn.hidden = !hasPages;
  nextBtn.hidden = !hasPages;
  prevBtn.disabled = page <= 0;
  nextBtn.disabled = page >= lastPage;
}

function getSortedMovies(regionCode, sortMode = currentSort) {
  const cached = regionDataCache.get(regionCode);
  if (!cached) return [];

  if (sortMode === SORT_RATING) {
    return rankNowPlayingByRating(cached.nowPlaying);
  }
  return rankNowPlayingByPopular(cached.nowPlaying, cached.popular);
}

async function fetchAndCacheRegion(regionCode) {
  const [nowPlaying, popular] = await Promise.all([
    fetchNowPlaying(regionCode),
    fetchMovieList(API_POPULAR, regionCode, 1),
  ]);
  regionDataCache.set(regionCode, { nowPlaying, popular });
}

function createMovieRow(regionConfig, movies) {
  const row = document.createElement("section");
  row.className = "movie-row";
  row.dataset.region = regionConfig.code;

  const country = document.createElement("h3");
  country.className = "movie-row__country";
  setCountryHeading(country, regionConfig);

  const slider = document.createElement("div");
  slider.className = "movie-row__slider";

  const grid = document.createElement("div");
  grid.className = "movie-row__grid";
  grid.setAttribute("role", "list");
  const sortLabel = currentSort === SORT_RATING ? "별점순" : "흥행순";
  grid.setAttribute(
    "aria-label",
    `${regionConfig.label} 현재 상영 영화 ${sortLabel}`
  );

  let page = getCarouselPage(regionConfig.code);
  const lastPage = maxCarouselPage(movies.length);
  if (page > lastPage) {
    page = 0;
    regionCarouselPage.set(regionConfig.code, 0);
  }

  fillMovieGrid(grid, movies, page, regionConfig.code);

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "movie-row__nav movie-row__nav--prev";
  prevBtn.setAttribute("aria-label", "이전 6편");
  prevBtn.innerHTML = "&#8249;";

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "movie-row__nav movie-row__nav--next";
  nextBtn.setAttribute("aria-label", "다음 6편");
  nextBtn.innerHTML = "&#8250;";

  const goToPage = (nextPage) => {
    const clamped = Math.min(Math.max(0, nextPage), lastPage);
    regionCarouselPage.set(regionConfig.code, clamped);
    fillMovieGrid(grid, movies, clamped, regionConfig.code);
    updateRowNav(prevBtn, nextBtn, clamped, movies.length);
  };

  prevBtn.addEventListener("click", () => {
    goToPage(getCarouselPage(regionConfig.code) - 1);
  });
  nextBtn.addEventListener("click", () => {
    goToPage(getCarouselPage(regionConfig.code) + 1);
  });

  updateRowNav(prevBtn, nextBtn, page, movies.length);

  slider.append(prevBtn, grid, nextBtn);
  row.append(country, slider);
  return row;
}

function renderMovieRows() {
  rowsEl.replaceChildren();
  const fragment = document.createDocumentFragment();

  for (const region of REGIONS) {
    const movies = getSortedMovies(region.code);
    if (movies.length > 0) {
      fragment.appendChild(createMovieRow(region, movies));
    }
  }

  if (fragment.childNodes.length === 0) {
    setPageStatus("표시할 상영 중 영화가 없습니다.");
    return;
  }

  rowsEl.appendChild(fragment);
  setPageStatus("");
}

function initSortControls() {
  const inputs = document.querySelectorAll('input[name="movie-sort"]');
  inputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      currentSort = input.value;
      REGIONS.forEach((region) => regionCarouselPage.set(region.code, 0));
      if (regionDataCache.size > 0) {
        renderMovieRows();
      }
    });
  });
}

async function loadMovies() {
  try {
    await Promise.all(REGIONS.map((r) => fetchAndCacheRegion(r.code)));
    renderMovieRows();
  } catch (err) {
    console.error(err);
    setPageStatus(
      "영화 목록을 불러오지 못했습니다. 네트워크 연결과 API 키를 확인해 주세요.",
      true
    );
  }
}

initHeaderOnScroll();
initMovieModal();
initSortControls();
loadMovies();
