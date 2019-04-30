const http = require('http');

const state = {
  list: [],
};

const server = http.createServer((req, res) => {
  const { method } = req;

  console.log('Method: ', method);

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': false,
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Allow-Headers': 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept',
    'Content-Type': 'application/json',
  };

  if (method === 'OPTIONS') {
    res.writeHead(200, headers);
    res.end();

    return;
  }

  res.setHeader('Content-Type', 'application/json');

  if (method === 'POST') {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();

      console.log('Request body', body);

      state.list = JSON.parse(body);

      res.writeHead(200, headers);
      res.write(JSON.stringify({ success: true }));
      res.end();
    });

    return;
  }

  if (method === 'GET') {
    res.writeHead(200, headers);
    res.write(JSON.stringify({ success: true, data: state.list }));
    res.end();

    return;
  }

  res.end();
});

server.listen(8888);
