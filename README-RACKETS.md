# Выгрузка теннисных ракеток с Tennis Warehouse Europe

## Установка зависимостей

```bash
npm install axios cheerio
```

## Настройка

1. Добавьте в `.env` файл:
```
TENNIS_WAREHOUSE_URL=https://www.tenniswarehouse-europe.com
```

2. Убедитесь, что база данных настроена и доступна.

## Использование

### Требования

1. Убедитесь, что в `.env` файле указан `OPENAI_API_KEY` для перевода описаний:
```
OPENAI_API_KEY=your-api-key-here
```

2. Убедитесь, что база данных настроена и доступна.

### Запуск скрипта выгрузки

```bash
node scripts/scrape-rackets.js
```

Скрипт:
- Найдет все ракетки брендов: Head, Yonex, Wilson, Babolat
- Извлечет название и год выпуска
- Загрузит описание с страницы товара
- Переведет описание на русский (если оно на английском)
- Сохранит данные в базу данных
- Создаст резервную копию в `scripts/rackets-backup.json`

**Примечание:** Скрипт делает задержки между запросами, чтобы не перегружать сайт и API OpenAI. Полная выгрузка может занять некоторое время.

## Важно: Адаптация под реальную структуру сайта

Скрипт использует общие селекторы CSS, которые нужно адаптировать под реальную структуру сайта Tennis Warehouse Europe.

### Что нужно проверить и изменить:

1. **URL страницы с ракетками бренда** (строка ~45 в `scrape-rackets.js`):
   ```javascript
   const brandUrl = `${BASE_URL}/catpage-racket-en.html?brand=${encodeURIComponent(brand)}`;
   ```
   Проверьте реальный URL на сайте.

2. **Селекторы для списка ракеток** (строка ~58):
   ```javascript
   $('.product-item, .racket-item, .product').each(...)
   ```
   Найдите правильный класс/селектор для контейнера ракетки.

3. **Селекторы для названия** (строка ~62):
   ```javascript
   const name = $el.find('.product-name, .racket-name, h2, h3').first().text().trim();
   ```

4. **Селекторы для цены** (строка ~63):
   ```javascript
   const priceText = $el.find('.price, .product-price').first().text().trim();
   ```

5. **Селекторы для изображения** (строка ~64):
   ```javascript
   const imageUrl = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
   ```

6. **Селекторы для описания** (строка ~95):
   ```javascript
   const description = $('.product-description, .description, #description').text().trim();
   ```

7. **Селекторы для характеристик** (строка ~99):
   ```javascript
   $('.spec-table tr, .specifications tr, .product-specs tr').each(...)
   ```

### Как найти правильные селекторы:

1. Откройте сайт Tennis Warehouse Europe в браузере
2. Откройте DevTools (F12)
3. Найдите элемент с ракеткой на странице
4. Посмотрите его HTML структуру
5. Определите уникальные классы/атрибуты
6. Обновите селекторы в скрипте

## Структура базы данных

Таблица `tennis_rackets`:
- `id` - UUID
- `brand` - VARCHAR(100) - бренд (Head, Yonex, Wilson, Babolat)
- `name` - VARCHAR(255) - название модели
- `year` - INTEGER - год выпуска (извлекается из названия или описания)
- `description_ru` - TEXT - описание на русском языке (автоматически переводится, если изначально на английском)
- `product_url` - TEXT UNIQUE - URL страницы товара на сайте
- `created_at` - TIMESTAMP
- `updated_at` - TIMESTAMP

## Что собирается

Скрипт собирает только:
1. **Название** ракетки
2. **Год выпуска** (автоматически извлекается из названия или описания)
3. **Описание на русском** (если изначально на английском - переводится через OpenAI)

## API Endpoints (будут добавлены)

После выгрузки данных можно создать API для:
- `GET /api/rackets` - список всех ракеток с фильтрами
- `GET /api/rackets/:id` - детали ракетки
- `GET /api/rackets/brand/:brand` - ракетки по бренду

## Обновление данных

Для регулярного обновления можно настроить cron job или scheduled task:

```bash
# Каждый день в 3:00
0 3 * * * cd /path/to/project && node scripts/scrape-rackets.js
```
