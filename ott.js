const API_DISCOVER = "https://api.themoviedb.org/3/discover/movie";
const MOVIES_PER_ROW = 6;

const OTT_FILTERS = OTT_PROVIDERS;

let selectedProviderId = OTT_FILTERS[0].id;

const filterEl = document.getElementById("ott-filter");
const rowsEl = document.getElementById("movie-rows");

function discoverUrl(regionCode, providerId) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    language: "ko-KR",
    watch_region: regionCode,
    with_watch_providers: String(providerId),
    with_watch_monetization_types: "flatrate|rent|buy",
    sort_by: "popularity.desc",
    page: "1",
    include_adult: "false",
  });
  return `${API_DISCOVER}?${params}`;
}

async function fetchMoviesByOtt(regionCode, providerId) {
  const res = await fetch(discoverUrl(regionCode, providerId));
  if (!res.ok) {
    throw new Error(`discover 오류 (${res.status}) — ${regionCode}`);
  }
  const data = await res.json();
  return (data.results ?? []).slice(0, MOVIES_PER_ROW);
}

function getOttLabel(providerId) {
  return getOttProviderLabel(providerId);
}

function renderOttFilterButtons() {
  if (!filterEl) return;

  filterEl.replaceChildren();
  const fragment = document.createDocumentFragment();

  OTT_FILTERS.forEach((ott) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ott-filter__btn";
    btn.dataset.providerId = String(ott.id);
    btn.textContent = ott.label;
    btn.setAttribute("aria-pressed", ott.id === selectedProviderId);

    if (ott.id === selectedProviderId) {
      btn.classList.add("ott-filter__btn--active");
    }

    btn.addEventListener("click", () => {
      if (selectedProviderId === ott.id) return;
      selectedProviderId = ott.id;
      renderOttFilterButtons();
      void loadOttMovies();
    });

    fragment.appendChild(btn);
  });

  filterEl.appendChild(fragment);
}

function renderOttRows(resultsByRegion) {
  if (!rowsEl) return;
  rowsEl.replaceChildren();

  const ottLabel = getOttLabel(selectedProviderId);

  const fragment = document.createDocumentFragment();
  let total = 0;

  REGIONS.forEach((region, index) => {
    const movies = resultsByRegion[index] ?? [];
    total += movies.length;
    if (movies.length > 0) {
      fragment.appendChild(
        createSimpleMovieRow(
          region,
          movies,
          `${ottLabel} 시청 가능 인기 영화`,
          { providerId: selectedProviderId }
        )
      );
    }
  });

  if (total === 0) {
    setPageStatus(
      `${ottLabel}에서 찾을 수 있는 영화가 없습니다. 다른 OTT를 선택해 보세요.`
    );
    return;
  }

  rowsEl.appendChild(fragment);
  setPageStatus("");
}

async function loadOttMovies() {
  setPageStatus("영화 목록을 불러오는 중…");

  try {
    const results = await Promise.all(
      REGIONS.map((region) => fetchMoviesByOtt(region.code, selectedProviderId))
    );
    renderOttRows(results);
  } catch (err) {
    console.error(err);
    setPageStatus(
      "영화 목록을 불러오지 못했습니다. 네트워크 연결과 API 키를 확인해 주세요.",
      true
    );
  }
}

renderOttFilterButtons();
initHeaderOnScroll();
initMovieModal();
loadOttMovies();
