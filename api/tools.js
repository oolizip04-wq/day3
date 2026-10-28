// 에이전트 도구 모음: find_spots(관광지 찾기) · get_weather(날씨 조회)
const data = require('../jeju_spots.json');

const AREAS = ['동쪽', '서쪽', '서귀포', '제주시'];
const MAX_RESULTS = 8;

// 날씨를 조회할 때 쓰는 지역별 대표 좌표
const AREA_POINT = {
  '동쪽': { lat: 33.458, lon: 126.942 },   // 성산
  '서쪽': { lat: 33.414, lon: 126.268 },   // 한림
  '서귀포': { lat: 33.254, lon: 126.560 },
  '제주시': { lat: 33.500, lon: 126.531 }
};

// 지역별로 데이터에 들어 있는 동·읍·면 이름 (예: 제주시 -> 연동, 노형동, 애월읍 ...)
const DONGS_BY_AREA = {};
for (const a of AREAS) {
  DONGS_BY_AREA[a] = [...new Set(data.spots.filter(s => s.area.startsWith(a) && s.dong).map(s => s.dong))];
}

// 입력: { area: '동쪽'|'서쪽'|'서귀포'|'제주시', dong?: string, indoor?: boolean }
// JSON 의 area 는 '동쪽(성산)' 처럼 괄호가 붙어 있어서 앞부분이 같은지로 비교한다.
// dong 은 '연동' 처럼 정확히 쓰거나 '노형' 처럼 앞부분만 써도 찾는다.
function find_spots({ area, dong, indoor } = {}) {
  if (!AREAS.includes(area)) {
    return { error: 'area 는 ' + AREAS.join(' · ') + ' 중 하나여야 합니다.' };
  }
  const wanted = typeof dong === 'string' ? dong.trim() : '';
  const matched = data.spots.filter(s =>
    s.area.startsWith(area) &&
    (!wanted || (s.dong && s.dong.startsWith(wanted))) &&
    (typeof indoor !== 'boolean' || s.indoor === indoor)
  );
  const result = {
    total: matched.length,
    spots: matched.slice(0, MAX_RESULTS).map(s => ({
      name: s.name,
      areas: s.area,
      dong: s.dong || '',
      indoor: s.indoor,
      description: s.type
    }))
  };
  if (wanted && matched.length === 0) {
    result.note = '"' + wanted + '" 에 해당하는 장소가 목록에 없다. ' + area + '에서 쓸 수 있는 동·읍·면: ' + DONGS_BY_AREA[area].join(', ');
  }
  return result;
}

// Open-Meteo 의 날씨 코드(WMO) -> 한글 설명
function weatherText(code) {
  if (code === 0) return '맑음';
  if (code <= 3) return '구름 조금 ~ 흐림';
  if (code <= 48) return '안개';
  if (code <= 57) return '이슬비';
  if (code <= 67) return '비';
  if (code <= 77) return '눈';
  if (code <= 82) return '소나기';
  if (code <= 86) return '눈 소나기';
  return '뇌우';
}

// 입력: { area } -> Open-Meteo(open-meteo.com) 현재 날씨와 오늘 예보. API 키가 필요 없다.
async function get_weather({ area } = {}) {
  const point = AREA_POINT[area];
  if (!point) {
    return { error: 'area 는 ' + AREAS.join(' · ') + ' 중 하나여야 합니다.' };
  }
  const url = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
    latitude: point.lat,
    longitude: point.lon,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weather_code',
    daily: 'precipitation_probability_max,temperature_2m_max,temperature_2m_min',
    timezone: 'Asia/Seoul',
    forecast_days: 1
  });
  const res = await fetch(url);
  if (!res.ok) {
    return { error: '날씨 조회 실패 (' + res.status + ')' };
  }
  const w = await res.json();
  return {
    area,
    description: weatherText(w.current.weather_code),
    temp: w.current.temperature_2m,
    feels_like: w.current.apparent_temperature,
    humidity: w.current.relative_humidity_2m,
    wind_kmh: w.current.wind_speed_10m,
    rain_mm: w.current.precipitation,
    today_rain_chance_percent: w.daily.precipitation_probability_max[0],
    today_max: w.daily.temperature_2m_max[0],
    today_min: w.daily.temperature_2m_min[0]
  };
}

// 도구 설명 (name · description · input_schema). Gemini 에는 아래에서 형식을 바꿔서 쓴다.
const find_spots_tool = {
  name: 'find_spots',
  description:
    '제주도 관광지 목록(jeju_spots.json)에서 지역과 실내/야외 조건에 맞는 장소를 최대 8곳 찾아 준다. ' +
    '각 장소의 이름 · 지역 · 동/읍/면 · 실내 여부 · 설명(유형)을 돌려준다. ' +
    '사용자가 연동 · 노형동 · 중문동 · 애월 같은 동/읍/면을 말하면 그 이름을 dong 에 넣고, 해당하는 area 도 함께 지정한다. ' +
    '선택할 수 있는 dong: ' + AREAS.map(a => a + '(' + DONGS_BY_AREA[a].join(', ') + ')').join(' / ') + '. ' +
    '목록 밖 장소는 없다: 결과에 없는 장소를 추천하거나 지어내지 말고, 결과가 비어 있으면 없다고 답한다.',
  input_schema: {
    type: 'object',
    properties: {
      area: {
        type: 'string',
        enum: AREAS,
        description: '찾을 지역. dong 이 속한 지역을 넣는다 (예: 연동 -> 제주시, 중문동 -> 서귀포).'
      },
      dong: {
        type: 'string',
        description: '동/읍/면 이름 (예: 연동, 노형동, 중문동, 애월읍). 생략하면 지역 전체.'
      },
      indoor: {
        type: 'boolean',
        description: 'true 면 실내만, false 면 야외만. 생략하면 둘 다.'
      }
    },
    required: ['area']
  }
};

const get_weather_tool = {
  name: 'get_weather',
  description:
    '제주도 지역의 현재 날씨(날씨 설명 · 기온 · 체감온도 · 습도 · 풍속 · 강수량)와 오늘의 최고/최저 기온 · 강수 확률을 알려 준다. ' +
    '야외와 실내 중 어느 쪽을 추천할지 정할 때 먼저 호출한다.',
  input_schema: {
    type: 'object',
    properties: {
      area: {
        type: 'string',
        enum: AREAS,
        description: '날씨를 알고 싶은 지역'
      }
    },
    required: ['area']
  }
};

const tools = [find_spots_tool, get_weather_tool];

// Gemini API 의 functionDeclarations 형식 (input_schema 가 parameters 로 이름만 다르다)
const functionDeclarations = tools.map(t => ({
  name: t.name,
  description: t.description,
  parameters: t.input_schema
}));

module.exports = {
  tools,
  functionDeclarations,
  handlers: { find_spots, get_weather },
  find_spots,
  get_weather,
  find_spots_tool,
  get_weather_tool
};
