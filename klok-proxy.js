const fs = require('fs');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { LoremIpsum } = require('lorem-ipsum');
const colors = require('colors');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');

const CONFIG = {
  API_BASE_URL: 'https://api1-pp.klokapp.ai/v1',
  TOKEN_FILE: 'klok.txt',
  PROXY_FILE: 'proxy.txt',
  MIN_INTERVAL: 10000,
  MAX_INTERVAL: 30000,
  MAX_FAILED_ATTEMPTS: 3,
};

const lorem = new LoremIpsum({
  sentencesPerParagraph: {
    max: 2,
    min: 1
  },
  wordsPerSentence: {
    max: 10,
    min: 4
  }
});

function log(msg, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  switch(type) {
    case 'success':
      console.log(`[${timestamp}] [✓] ${msg}`.green);
      break;
    case 'custom':
      console.log(`[${timestamp}] [*] ${msg}`.magenta);
      break;        
    case 'error':
      console.log(`[${timestamp}] [✗] ${msg}`.red);
      break;
    case 'warning':
      console.log(`[${timestamp}] [!] ${msg}`.yellow);
      break;
    default:
      console.log(`[${timestamp}] [ℹ] ${msg}`.blue);
  }
}

async function countdown(seconds) {
  for (let i = seconds; i > 0; i--) {
    const timestamp = new Date().toLocaleTimeString();
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`[${timestamp}] [*] Chờ ${i} giây để tiếp tục...`.magenta);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  readline.cursorTo(process.stdout, 0);
  readline.clearLine(process.stdout, 0);
}

function getRandomMessage() {
  const method = Math.floor(Math.random() * 3);
  
  switch (method) {
    case 0:
      return lorem.generateSentences(1);
    
    case 1:
      const topics = [
        "artificial intelligence",
        "machine learning",
        "technology",
        "science",
        "nature",
        "philosophy",
        "art",
        "music",
        "history",
        "literature"
      ];
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      const questionTemplates = [
        `What do you think about ${randomTopic}?`,
        `Can you tell me something interesting about ${randomTopic}?`,
        `How has ${randomTopic} changed in recent years?`,
        `Why is ${randomTopic} important?`,
        `What's your favorite aspect of ${randomTopic}?`
      ];
      return questionTemplates[Math.floor(Math.random() * questionTemplates.length)];
    
    case 2:
      const conversationalPrompts = [
        "Tell me something I might not know.",
        "What's the most interesting thing you've learned recently?",
        "If you could solve one global problem, what would it be?",
        "What's a book or article that changed your perspective?",
        "What's a common misconception many people have?",
        "How would you explain complex ideas to someone new to the topic?",
        "What advancements do you think we'll see in the next decade?",
        "What's a skill everyone should learn?",
        "How do you approach learning something new?",
        "What makes a good conversation in your opinion?"
      ];
      return conversationalPrompts[Math.floor(Math.random() * conversationalPrompts.length)];
  }
}

function getRandomInterval() {
  return Math.floor(Math.random() * (CONFIG.MAX_INTERVAL - CONFIG.MIN_INTERVAL + 1)) + CONFIG.MIN_INTERVAL;
}

function readTokens() {
  try {
    const data = fs.readFileSync(CONFIG.TOKEN_FILE, 'utf8');
    const tokens = data
      .split('\n')
      .map(token => token.replace(/[\r\n]/g, '').trim())
      .filter(token => token !== '');
    
    if (tokens.length === 0) {
      log('Bạn chưa ném token vào klok.txt', 'error');
      process.exit(1);
    }
    
    log(`Đã đọc ${tokens.length} token từ klok.txt`, 'success');
    return tokens;
  } catch (error) {
    log(`Không thể đọc file klok.txt: ${error}`, 'error');
    process.exit(1);
  }
}

function readProxies() {
  try {
    const data = fs.readFileSync(CONFIG.PROXY_FILE, 'utf8');
    const proxies = data.split('\n').filter(proxy => proxy.trim() !== '');
    
    if (proxies.length === 0) {
      log('Bạn chưa ném proxy vào proxy.txt', 'error');
      process.exit(1);
    }
    
    log(`Đã đọc ${proxies.length} proxy từ proxy.txt`, 'success');
    return proxies;
  } catch (error) {
    log(`Không thể đọc file proxy.txt: ${error}`, 'error');
    process.exit(1);
  }
}

async function checkProxyIP(proxy) {
  try {
    const proxyAgent = new HttpsProxyAgent(proxy);
    const response = await axios.get('https://api.ipify.org?format=json', {
      httpsAgent: proxyAgent,
      timeout: 10000
    });
    
    if (response.status === 200) {
      return response.data.ip;
    } else {
      throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
    }
  } catch (error) {
    throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
  }
}

function createApiClient(token, proxy) {
  const proxyAgent = proxy ? new HttpsProxyAgent(proxy) : null;
  
  return axios.create({
    baseURL: CONFIG.API_BASE_URL,
    headers: {
      'x-session-token': token,
      'accept': '*/*',
      'accept-encoding': 'gzip, deflate, br, zstd',
      'accept-language': 'en-US,en;q=0.9',
      'origin': 'https://klokapp.ai',
      'referer': 'https://klokapp.ai/',
      'sec-ch-ua': '"Not(A:Brand";v="99", "Microsoft Edge";v="133", "Chromium";v="133"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0'
    },
    httpsAgent: proxyAgent,
    timeout: 30000
  });
}

async function checkRateLimit(apiClient, accountIndex) {
  try {
    const response = await apiClient.get('/rate-limit');
    const rateData = response.data;
    
    if (rateData.remaining === 0) {
      const resetTimeMinutes = Math.ceil(rateData.reset_time / 60);
      return {
        hasRemaining: false,
        resetTime: rateData.reset_time,
        remaining: 0
      };
    }
    
    return {
      hasRemaining: true,
      resetTime: 0,
      remaining: rateData.remaining
    };
  } catch (error) {
    log(`Tài khoản ${accountIndex + 1}: Lỗi kiểm tra giới hạn: ${error.response?.status || error.message}`, 'error');
    return {
      hasRemaining: false,
      resetTime: 0,
      remaining: 0
    };
  }
}

async function getThreads(apiClient) {
  try {
    const response = await apiClient.get('/threads');
    return response.data.data;
  } catch (error) {
    log(`Lỗi lấy danh sách cuộc trò chuyện: ${error.response?.status || error.message}`, 'error');
    return [];
  }
}

async function createNewThread(apiClient, message) {
  const threadId = uuidv4();
  const chatData = {
    id: threadId,
    title: "",
    messages: [
      {
        role: "user",
        content: message
      }
    ],
    sources: [],
    model: "llama-3.3-70b-instruct",
    created_at: new Date().toISOString(),
    language: "english"
  };

  try {
    const response = await apiClient.post('/chat', chatData);
    log(`Cuộc trò chuyện mới được tạo thành công với ID: ${threadId}`, 'success');
    return { id: threadId };
  } catch (error) {
    if (error.message.includes('stream has been aborted')) {
      return { id: threadId };
    }
    log(`Không thể tạo cuộc trò chuyện mới: ${error.response?.status || error.message}`, 'error');
    return null;
  }
}

async function sendMessageToThread(apiClient, threadId, message) {
  try {
    const chatData = {
      id: threadId,
      title: "",
      messages: [
        {
          role: "user",
          content: message
        }
      ],
      sources: [],
      model: "llama-3.3-70b-instruct",
      created_at: new Date().toISOString(),
      language: "english"
    };

    const response = await apiClient.post('/chat', chatData);
    log(`Tin nhắn đã được gửi thành công tới cuộc trò chuyện: ${threadId}`, 'success');
    return response.data;
  } catch (error) {
    if (error.message.includes('stream has been aborted')) {
      return true;
    }
    log(`Lỗi gửi tin nhắn: ${error.response?.status || error.message}`, 'error');
    return null;
  }
}

async function checkPoints(apiClient, accountIndex, proxyIP = 'Unknown') {
  try {
    const response = await apiClient.get('/points');
    const pointsData = response.data;
    
    log(`Tài khoản ${accountIndex + 1} | IP: ${proxyIP} | Points: ${pointsData.total_points || 0}`, 'custom');
    
    return pointsData;
  } catch (error) {
    log(`Lỗi không đọc được điểm của tài khoản ${accountIndex + 1}: ${error.response?.status || error.message}`, 'error');
    return null;
  }
}

async function handleAccount(token, proxy, accountIndex) {
  log(`Đang xử lý tài khoản ${accountIndex + 1}...`);
  
  let proxyIP = 'Unknown';
  try {
    proxyIP = await checkProxyIP(proxy);
    log(`Tài khoản ${accountIndex + 1}: Sử dụng proxy IP: ${proxyIP}`, 'success');
  } catch (error) {
    log(`Tài khoản ${accountIndex + 1}: Không thể kiểm tra IP của proxy: ${error.message}`, 'warning');
  }
  
  const apiClient = createApiClient(token, proxy);
  let currentThreadId = null;

  const pointsData = await checkPoints(apiClient, accountIndex, proxyIP);
  
  const rateLimitInfo = await checkRateLimit(apiClient, accountIndex);
  if (!rateLimitInfo.hasRemaining) {
    return {
      token,
      proxy,
      proxyIP,
      apiClient,
      currentThreadId: null,
      accountIndex,
      rateLimited: true,
      resetTime: rateLimitInfo.resetTime,
      failedAttempts: 0,
      points: pointsData?.total_points || 0,
      remainingChats: rateLimitInfo.remaining
    };
  }

  const threads = await getThreads(apiClient);
  if (threads.length > 0) {
    currentThreadId = threads[0].id;
    log(`Tài khoản ${accountIndex + 1}: Sử dụng cuộc trò chuyện đang có: ${currentThreadId}`, 'success');
  } else {
    const newThread = await createNewThread(apiClient, "Starting new conversation");
    if (newThread) {
      currentThreadId = newThread.id;
      log(`Tài khoản ${accountIndex + 1}: Bắt đầu cuộc trò chuyện mới: ${currentThreadId}`, 'success');
    }
  }

  return {
    token,
    proxy,
    proxyIP,
    apiClient,
    currentThreadId,
    accountIndex,
    rateLimited: false,
    resetTime: 0,
    failedAttempts: 0,
    lastRateLimitCheck: Date.now(),
    points: pointsData?.total_points || 0,
    remainingChats: rateLimitInfo.remaining
  };
}

async function runBot() {
  log('Dân Cày Airdrop...', 'custom');
  const tokens = readTokens();
  const proxies = readProxies();
  
  if (tokens.length !== proxies.length) {
    log(`Số lượng token (${tokens.length}) và proxy (${proxies.length}) không khớp nhau. Vui lòng kiểm tra lại.`, 'error');
    process.exit(1);
  }
  
  const accounts = [];

  for (let i = 0; i < tokens.length; i++) {
    try {
      const account = await handleAccount(tokens[i], proxies[i], i);
      accounts.push(account);
    } catch (error) {
      log(`Lỗi xử lý tài khoản ${i + 1}: ${error.message}`, 'error');
      accounts.push({
        token: tokens[i],
        proxy: proxies[i],
        proxyIP: 'Error',
        apiClient: null,
        currentThreadId: null,
        accountIndex: i,
        rateLimited: true,
        resetTime: 0,
        failedAttempts: 0,
        hasError: true,
        points: 0,
        remainingChats: 0
      });
    }
  }

  async function processAccounts() {
    let allAccountsLimited = true;
    let minResetTime = 24 * 60 * 60;
    
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      
      if (account.hasError) {
        log(`Bỏ qua tài khoản ${account.accountIndex + 1} do lỗi trước đó`, 'warning');
        continue;
      }
      
      try {
        const apiClient = createApiClient(account.token, account.proxy);
        account.apiClient = apiClient;
        
        const rateLimitInfo = await checkRateLimit(account.apiClient, account.accountIndex);
        account.rateLimited = !rateLimitInfo.hasRemaining;
        account.resetTime = rateLimitInfo.resetTime;
        account.remainingChats = rateLimitInfo.remaining;
        account.lastRateLimitCheck = Date.now();
        
        if (!account.rateLimited) {
          allAccountsLimited = false;
        } else if (account.resetTime > 0 && account.resetTime < minResetTime) {
          minResetTime = account.resetTime;
          continue;
        }
        
        if (account.rateLimited) {
          continue;
        }
        
        const pointsBefore = await checkPoints(account.apiClient, account.accountIndex, account.proxyIP);
        if (!pointsBefore || pointsBefore.total_points <= 0) {
          log(`Tài khoản ${account.accountIndex + 1}: Không có điểm nào...`, 'warning');
          continue;
        }
        
        account.points = pointsBefore.total_points;
        
        if (!account.currentThreadId) {
          log(`Tài khoản ${account.accountIndex + 1}: Không có cuộc trò chuyện nào hoạt động có sẵn. Tạo cuộc trò chuyện mới...`, 'warning');
          const newThread = await createNewThread(account.apiClient, "Starting new conversation");
          if (newThread) {
            account.currentThreadId = newThread.id;
            account.failedAttempts = 0; 
          } else {
            continue;
          }
        }
  
        const message = getRandomMessage();
        log(`Tài khoản ${account.accountIndex + 1}: Gửi tin nhắn: "${message}"`, 'info');
        
        const result = await sendMessageToThread(account.apiClient, account.currentThreadId, message);
        
        const rateLimitAfter = await checkRateLimit(account.apiClient, account.accountIndex);
        account.remainingChats = rateLimitAfter.remaining;
        
        const pointsAfter = await checkPoints(account.apiClient, account.accountIndex, account.proxyIP);
        
        if (!result) {
          account.failedAttempts++;
          log(`Tài khoản ${account.accountIndex + 1}: Không có phản hồi. Bot ko thèm rep lần ${account.failedAttempts}/${CONFIG.MAX_FAILED_ATTEMPTS}`, 'warning');
          
          if (account.failedAttempts >= CONFIG.MAX_FAILED_ATTEMPTS) {
            log(`Tài khoản ${account.accountIndex + 1}: Đã bị bot bơ ${CONFIG.MAX_FAILED_ATTEMPTS} lần liên tiếp. Tạo cuộc trò chuyện mới.`, 'warning');
            account.currentThreadId = null;
            account.failedAttempts = 0;
          }
        } else {
          if (pointsAfter && pointsBefore && pointsAfter.total_points <= pointsBefore.total_points) {
            log(`Tài khoản ${account.accountIndex + 1}: Điểm không tăng sau khi gửi tin nhắn. Tạo cuộc trò chuyện mới.`, 'warning');
            account.currentThreadId = null;
          } else {
            log(`Tài khoản ${account.accountIndex + 1}: Nhận phản hồi thành công. Điểm hiện tại: ${pointsAfter ? pointsAfter.total_points : 'Unknown'}`, 'success');
            account.failedAttempts = 0;
            account.points = pointsAfter ? pointsAfter.total_points : account.points;
          }
        }
      } catch (error) {
        log(`Lỗi xử lý tài khoản ${account.accountIndex + 1}: ${error.message}`, 'error');
        try {
          account.proxyIP = await checkProxyIP(account.proxy);
          log(`Tài khoản ${account.accountIndex + 1}: Làm mới proxy IP: ${account.proxyIP}`, 'success');
        } catch (proxyError) {
          log(`Tài khoản ${account.accountIndex + 1}: Proxy có thể bị lỗi: ${proxyError.message}`, 'warning');
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  
    if (allAccountsLimited) {
      log("Tất cả tài khoản đều đã đạt giới hạn. Đợi một thời gian trước khi thử lại.", 'warning');
      
      if (minResetTime < 24 * 60 * 60 && minResetTime > 0) {
        log(`Đợi ${Math.ceil(minResetTime / 60)} phút cho đến khi rate limit được reset...`, 'custom');
        await countdown(minResetTime);
      } else {
        log("Đợi 24 giờ trước khi thử lại...", 'custom');
        const waitSeconds = 86400;
        await countdown(waitSeconds);
      }
    } else {
      const nextInterval = getRandomInterval();
      log(`Cuộc trò chuyện tiếp theo sẽ diễn ra trong ${nextInterval/1000} giây`, 'info');
      await countdown(nextInterval/1000);
    }
    
    processAccounts();
  }

  processAccounts();
}

runBot().catch(error => {
  log(`Bot crashed: ${error}`, 'error');
  process.exit(1);
});