require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Инициализация OpenAI для перевода
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

// Бренды для выгрузки
const BRANDS = ['Head', 'Yonex', 'Wilson', 'Babolat'];

// Базовый URL сайта (нужно уточнить точный URL)
const BASE_URL = process.env.TENNIS_WAREHOUSE_URL || 'https://www.tenniswarehouse-europe.com';

// Задержка между запросами (в миллисекундах) для избежания блокировки
const DELAY_MS = 2000;

// Функция для задержки
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Функция для перевода текста на русский
async function translateToRussian(text) {
  if (!text || !text.trim()) {
    return '';
  }
  
  // Проверяем, не русский ли уже текст (простая проверка)
  const russianPattern = /[а-яё]/i;
  if (russianPattern.test(text)) {
    return text.trim();
  }
  
  if (!openai) {
    console.warn('⚠️ OpenAI не настроен, возвращаю оригинальный текст');
    return text.trim();
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Ты профессиональный переводчик. Переведи текст на русский язык, сохраняя техническую терминологию и структуру. Если текст уже на русском, верни его без изменений."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Ошибка при переводе:', error.message);
    return text.trim();
  }
}

// Функция для извлечения года из названия или описания
function extractYear(text) {
  if (!text) return null;
  
  // Ищем 4-значное число, которое выглядит как год (обычно между 2000 и текущим годом)
  const currentYear = new Date().getFullYear();
  const yearPattern = /\b(19\d{2}|20[0-2]\d)\b/;
  const matches = text.match(yearPattern);
  
  if (matches) {
    const year = parseInt(matches[1]);
    if (year >= 2000 && year <= currentYear + 1) {
      return year;
    }
  }
  
  return null;
}

// Функция для получения списка ракеток по бренду
async function getRacketsByBrand(brand) {
  try {
    console.log(`\n🔍 Поиск ракеток бренда: ${brand}`);
    
    // URL страницы с ракетками бренда (нужно уточнить точную структуру URL)
    const brandUrl = `${BASE_URL}/catpage-racket-en.html?brand=${encodeURIComponent(brand)}`;
    
    console.log(`📡 Запрос к: ${brandUrl}`);
    
    const response = await axios.get(brandUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 30000
    });
    
    const $ = cheerio.load(response.data);
    const rackets = [];
    
    // Парсинг списка ракеток (селекторы нужно уточнить по реальной структуре сайта)
    $('.product-item, .racket-item, .product').each((index, element) => {
      try {
        const $el = $(element);
        
        // Извлечение названия
        const name = $el.find('.product-name, .racket-name, h2, h3').first().text().trim();
        const productUrl = $el.find('a').first().attr('href');
        const fullProductUrl = productUrl?.startsWith('http') ? productUrl : `${BASE_URL}${productUrl}`;
        
        if (name) {
          // Извлекаем год из названия
          const year = extractYear(name);
          
          rackets.push({
            brand,
            name,
            year,
            productUrl: fullProductUrl
          });
        }
      } catch (err) {
        console.error(`Ошибка при парсинге элемента:`, err.message);
      }
    });
    
    console.log(`✅ Найдено ракеток: ${rackets.length}`);
    return rackets;
    
  } catch (error) {
    console.error(`❌ Ошибка при получении ракеток бренда ${brand}:`, error.message);
    if (error.response) {
      console.error(`Статус: ${error.response.status}`);
    }
    return [];
  }
}

// Функция для получения детальной информации о ракетке
async function getRacketDetails(racket) {
  try {
    if (!racket.productUrl) {
      return racket;
    }
    
    console.log(`  📄 Загрузка деталей: ${racket.name}`);
    
    await delay(DELAY_MS);
    
    const response = await axios.get(racket.productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 30000
    });
    
    const $ = cheerio.load(response.data);
    
    // Извлечение описания (пробуем разные селекторы)
    let description = $('.product-description, .description, #description, .product-details').first().text().trim();
    
    // Если не нашли, пробуем найти любой блок с описанием
    if (!description) {
      description = $('p').filter((i, el) => {
        const text = $(el).text().trim();
        return text.length > 50; // Берем первый длинный параграф
      }).first().text().trim();
    }
    
    // Если год не был найден в названии, ищем в описании
    if (!racket.year && description) {
      const yearFromDesc = extractYear(description);
      if (yearFromDesc) {
        racket.year = yearFromDesc;
      }
    }
    
    // Переводим описание на русский
    let descriptionRu = '';
    if (description) {
      console.log(`  🌐 Перевод описания...`);
      descriptionRu = await translateToRussian(description);
      await delay(1000); // Задержка между запросами к OpenAI
    }
    
    return {
      ...racket,
      descriptionRu
    };
    
  } catch (error) {
    console.error(`  ⚠️ Ошибка при загрузке деталей ${racket.name}:`, error.message);
    return racket;
  }
}

// Функция для сохранения ракетки в БД
async function saveRacketToDB(racket) {
  const client = await pool.connect();
  try {
    // Проверяем, существует ли уже ракетка с таким product_url
    const existing = await client.query(
      'SELECT id FROM tennis_rackets WHERE product_url = $1',
      [racket.productUrl]
    );
    
    if (existing.rows.length > 0) {
      // Обновляем существующую запись
      await client.query(`
        UPDATE tennis_rackets SET
          name = $1,
          year = $2,
          description_ru = $3,
          updated_at = NOW()
        WHERE product_url = $4
      `, [
        racket.name,
        racket.year,
        racket.descriptionRu || null,
        racket.productUrl
      ]);
      console.log(`  🔄 Обновлено: ${racket.name}`);
      return existing.rows[0].id;
    } else {
      // Создаем новую запись
      const racketId = uuidv4();
      await client.query(`
        INSERT INTO tennis_rackets (
          id, brand, name, year, description_ru, product_url, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, [
        racketId,
        racket.brand,
        racket.name,
        racket.year,
        racket.descriptionRu || null,
        racket.productUrl
      ]);
      console.log(`  ✅ Сохранено: ${racket.name}`);
      return racketId;
    }
  } catch (error) {
    console.error(`  ❌ Ошибка при сохранении ${racket.name}:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Основная функция
async function scrapeRackets() {
  console.log('🚀 Начало выгрузки ракеток...\n');
  
  const allRackets = [];
  
  // Получаем список ракеток по каждому бренду
  for (const brand of BRANDS) {
    const rackets = await getRacketsByBrand(brand);
    allRackets.push(...rackets);
    await delay(DELAY_MS);
  }
  
  console.log(`\n📊 Всего найдено ракеток: ${allRackets.length}\n`);
  
  // Получаем детальную информацию для каждой ракетки
  let saved = 0;
  let failed = 0;
  
  for (let i = 0; i < allRackets.length; i++) {
    const racket = allRackets[i];
    console.log(`\n[${i + 1}/${allRackets.length}] Обработка: ${racket.name}`);
    
    try {
      const detailedRacket = await getRacketDetails(racket);
      await saveRacketToDB(detailedRacket);
      saved++;
    } catch (error) {
      console.error(`❌ Не удалось сохранить ракетку:`, error.message);
      failed++;
    }
    
    // Задержка между запросами
    if (i < allRackets.length - 1) {
      await delay(DELAY_MS);
    }
  }
  
  console.log(`\n\n✅ Выгрузка завершена!`);
  console.log(`📈 Успешно сохранено: ${saved}`);
  console.log(`❌ Ошибок: ${failed}`);
  
  // Сохраняем также в JSON файл для резервной копии
  const outputFile = path.join(__dirname, 'rackets-backup.json');
  fs.writeFileSync(outputFile, JSON.stringify(allRackets, null, 2));
  console.log(`💾 Резервная копия сохранена в: ${outputFile}`);
}

// Запуск скрипта
if (require.main === module) {
  scrapeRackets()
    .then(() => {
      console.log('\n✨ Готово!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Критическая ошибка:', error);
      process.exit(1);
    });
}

module.exports = { scrapeRackets, getRacketsByBrand, getRacketDetails };
