// Vercel Serverless Function: 제주 여행 추천 에이전트
// Claude 가 find_spots / get_weather 도구를 스스로 골라 호출하고, 그 결과로 추천 답변을 만든다.
// 환경변수: ANTHROPIC_API_KEY (필수), OPENWEATHER_API_KEY (get_weather 용), ANTHROPIC_MODEL (선택)
const { tools, handlers } = require('./tools');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const MAX_TURNS = 6;

const SYSTEM =
  '너는 제주도 여행 추천 도우미다. 사용자의 요청에 맞는 장소를 도구로 찾아서 추천한다.\n' +
  '- 장소는 반드시 find_spots 결과에 있는 것만 추천한다. 목록 밖 장소는 없다고 생각하고 지어내지 않는다.\n' +
  '- 날씨가 중요한 요청이면 get_weather 로 현재 날씨를 확인하고, 비·강풍·추위면 실내, 맑으면 야외를 우선한다.\n' +
  '- 지역을 말하지 않았다면 사용자에게 되묻거나, 날씨와 조건을 보고 합리적으로 한 곳을 골라 이유를 말한다.\n' +
  '- 답변은 한국어로 짧게: 날씨 한 줄, 추천 장소 3~5곳(이름 · 왜 좋은지).';

async function callClaude(messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM, tools, messages })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Claude 호출 실패 (' + res.status + ') ' + text.slice(0, 200));
  }
  return res.json();
}

module.exports = async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았어요.' });
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const message = String(body.message || '').trim().slice(0, 500);
  if (!message) {
    return res.status(400).json({ error: '질문을 입력하세요.' });
  }

  const messages = [{ role: 'user', content: message }];
  const steps = []; // 화면에 보여줄 도구 호출 기록

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const reply = await callClaude(messages);
      messages.push({ role: 'assistant', content: reply.content });

      if (reply.stop_reason !== 'tool_use') {
        const text = reply.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
        return res.status(200).json({ reply: text, steps });
      }

      // 요청된 도구를 모두 실행하고 결과를 한 번에 돌려준다.
      const results = [];
      for (const block of reply.content.filter(b => b.type === 'tool_use')) {
        const handler = handlers[block.name];
        let output;
        try {
          output = handler ? await handler(block.input) : { error: '알 수 없는 도구: ' + block.name };
        } catch (err) {
          output = { error: String(err.message || err) };
        }
        steps.push({ tool: block.name, input: block.input, output });
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(output) });
      }
      messages.push({ role: 'user', content: results });
    }
    return res.status(200).json({ reply: '도구를 너무 많이 호출해서 중단했어요. 질문을 조금 더 구체적으로 해 주세요.', steps });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err), steps });
  }
};
