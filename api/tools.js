// Claude 도구 모음: find_spots(관광지 찾기) · get_weather(날씨 조회)
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

// 입력: { area: '동쪽'|'서쪽'|'서귀포'|'제주시', indoor?: boolean }
// JSON 의 area 는 '동쪽(성산)' 처럼 괄호가 붙어 있어서 앞부분이 같은지로 비교한다.
function find_spots({ area, indoor } = {}) {
  if (!AREAS.includes(area)) {
    return { error: 'area 는 ' + AREAS.join(' · ') + ' 중 하나여야 합니다.' };
  }
  const matched = data.spots.filter(s =>
    s.area.startsWith(area) && (typeof indoor !== 'boolean' || s.indoor === indoor)
  );
  return {
    total: matched.length,
    spots: matched.slice(0, MAX_RESULTS).map(s => ({
      name: s.name,
      areas: s.area,
      indoor: s.indoor,
      description: s.type
    }))
  };
}

// 입력: { area } -> OpenWeatherMap 현재 날씨.
// API 키는 화면에서 받은 값(keys.openweather)을 먼저 쓰고, 없으면 환경변수 OPENWEATHER_API_KEY 를 쓴다.
async function get_weather({ area } = {}, keys = {}) {
  const point = AREA_POINT[area];
  if (!point) {
    return { error: 'area 는 ' + AREAS.join(' · ') + ' 중 하나여야 합니다.' };
  }
  const key = keys.openweather || process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return { error: '날씨 API 키가 없어요. 화면의 "API 키 설정"에 OpenWeather 키를 입력하세요.' };
  }
  const url = 'https://api.openweathermap.org/data/2.5/weather?' + new URLSearchParams({
    lat: point.lat, lon: point.lon, appid: key, units: 'metric', lang: 'kr'
  });
  const res = await fetch(url);
  if (!res.ok) {
    return { error: '날씨 조회 실패 (' + res.status + ')' };
  }
  const w = await res.json();
  return {
    area,
    description: w.weather && w.weather[0] ? w.weather[0].description : '',
    temp: w.main.temp,
    feels_like: w.main.feels_like,
    humidity: w.main.humidity,
    wind_speed: w.wind ? w.wind.speed : 0,
    rain_mm_1h: w.rain ? w.rain['1h'] || 0 : 0
  };
}

// Claude API 의 tools 배열에 그대로 넣을 도구 설명
const find_spots_tool = {
  name: 'find_spots',
  description:
    '제주도 관광지 목록(jeju_spots.json)에서 지역과 실내/야외 조건에 맞는 장소를 최대 8곳 찾아 준다. ' +
    '각 장소의 이름 · 지역 · 실내 여부 · 설명(유형)을 돌려준다. ' +
    '목록 밖 장소는 없다: 결과에 없는 장소를 추천하거나 지어내지 말고, 결과가 비어 있으면 없다고 답한다.',
  input_schema: {
    type: 'object',
    properties: {
      area: {
        type: 'string',
        enum: AREAS,
        description: '찾을 지역'
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
    '제주도 지역의 현재 날씨(날씨 설명 · 기온 · 체감온도 · 습도 · 풍속 · 최근 1시간 강수량)를 알려 준다. ' +
    '야외와 실내 중 어느 쪽을 추천할지 정할 때 먼저 호출한다. 예보가 아니라 현재 날씨다.',
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
