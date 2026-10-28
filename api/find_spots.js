// Vercel Serverless Function: find_spots 도구를 웹에서 호출할 수 있게 해 주는 API
// 사용: /api/find_spots?area=동쪽&indoor=true   (indoor 는 생략 가능)
const { find_spots } = require('./tools');

module.exports = (req, res) => {
  const area = String(req.query.area || '');
  const indoor = req.query.indoor === 'true' ? true : req.query.indoor === 'false' ? false : undefined;

  const result = find_spots({ area, indoor });
  if (result.error) {
    return res.status(400).json(result);
  }
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return res.status(200).json(result);
};
