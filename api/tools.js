// Claude 도구 모음: jeju_spots.json 에서 관광지를 골라 주는 find_spots
const data = require('../jeju_spots.json');

const AREAS = ['동쪽', '서쪽', '서귀포', '제주시'];
const MAX_RESULTS = 8;

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

module.exports = {
  tools: [find_spots_tool],
  handlers: { find_spots },
  find_spots,
  find_spots_tool
};
