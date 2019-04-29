addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function generate_rand(i) { // recursively fetch randon values incase there is a collision
  
  if (typeof i == 'undefined') {
    i = 0;
  }

  if (i >= 5) {
    throw new Error('Limiting random key checks to 5');
  }

  try {
    var rand_response = await fetch(new Request('https://csprng.xyz/v1/api?length=6'));
    var rand = await rand_response.json();
    var random_data = rand.Data;
    var exists = await WORKERS_KV_LINKS.get(random_data);
    if (exists) {
      throw new Error('Collision!');
    } else {
      return random_data;
    }
  } catch(e) {
    i++;
    return await generate_rand(i);
  }

}

async function handleRequest(request) {

  var request_url = new URL(request.url);

  short_url = request_url.pathname.split('/');

  if (short_url[1]) {

    var input = '';

    if (short_url.length > 1) {
      short_url.shift();
      input = short_url.join('/');
    } else {
      input = short_url[1];
    }

    var url = await WORKERS_KV_LINKS.get(input);

    if (url) {
      var requested_url = new URL(url);
      return Response.redirect(requested_url.toString(), 301);
    } else {
      return new Response(JSON.stringify({
        "Status" : 404,
        "Message" : 'Short url not found',
        "ShortUrl" : null
      }), {
        'status': 404,
        'statusText': 'Not found',
        'headers': { "Content-Type": "application/json" }
      });
    }

  } else {

    if (request_url.searchParams.get('new')) {

      try {
        
        var new_url = new URL(request_url.searchParams.get('new'));

        var rand_response = await fetch(new Request('https://csprng.xyz/v1/api?length=6'));
        var rand = await rand_response.json()

        try {
          var randomKey = await generate_rand();
        } catch(e) {
            return new Response(JSON.stringify({
              "Status" : 500,
              "Message" : e.message,
              "ShortUrl" : null
            }), {
              'status': 500,
              'statusText': 'Server error',
              'headers': { "Content-Type": "application/json" }
            });
        }

        var y = await WORKERS_KV_LINKS.put(randomKey, new_url.toString());

        var short_url = request_url.protocol + '//' + request_url.hostname + '/' + randomKey;

        return new Response(JSON.stringify({
          "Status" : 200,
          "Message" : "Successfully created new link",
          "ShortUrl" : short_url
        }), {
          'headers': { "Content-Type": "application/json" }
        });

      } catch (e) {
        return new Response(JSON.stringify({
          "Status" : 400,
          "Message" : e.message,
          "ShortUrl" : null
        }), {
          'status': 400,
          'statusText': 'Bad Request',
          'headers': { "Content-Type": "application/json" }
        });
      }
      
    } else {

      var index = await fetch('https://raw.githubusercontent.com/obezuk/cf-workers-link-shortener/master/index.html', {
        "cf" : {
          "cacheTtl" : 600,
          "cacheKey" : request.url
        }
      });

      return new Response(index.body, {
        'headers': { "Content-Type": "text/html" }
      });

    }

  }
  
}
