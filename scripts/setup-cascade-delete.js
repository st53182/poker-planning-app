require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function setupCascadeDelete() {
  const client = await pool.connect();
  try {
    console.log('Настройка CASCADE DELETE для связанных таблиц...\n');
    
    await client.query('BEGIN');
    
    try {
      // Настраиваем CASCADE для racket_ratings
      console.log('Настройка racket_ratings...');
      
      // Проверяем, существует ли таблица
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'racket_ratings'
        );
      `);
      
      if (tableExists.rows[0].exists) {
        // Удаляем существующие внешние ключи
        const fkResult = await client.query(`
          SELECT constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = 'racket_ratings'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'racket_id';
        `);
        
        for (const row of fkResult.rows) {
          try {
            await client.query(`ALTER TABLE racket_ratings DROP CONSTRAINT IF EXISTS ${row.constraint_name}`);
            console.log(`  Удален constraint: ${row.constraint_name}`);
          } catch (err) {
            console.warn(`  Не удалось удалить constraint ${row.constraint_name}:`, err.message);
          }
        }
        
        // Создаем новый с CASCADE
        try {
          await client.query(`
            ALTER TABLE racket_ratings 
            ADD CONSTRAINT fk_racket_ratings_racket_id 
            FOREIGN KEY (racket_id) 
            REFERENCES tennis_rackets(id) 
            ON DELETE CASCADE;
          `);
          console.log('  ✅ CASCADE DELETE настроен для racket_ratings');
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log('  ℹ️  Constraint уже существует');
          } else {
            throw err;
          }
        }
      } else {
        console.log('  ℹ️  Таблица racket_ratings не существует');
      }
      
      // Аналогично для других таблиц
      const relatedTables = [
        { name: 'racket_reviews', column: 'racket_id' },
        { name: 'racket_comments', column: 'racket_id' },
        { name: 'racket_favorites', column: 'racket_id' }
      ];
      
      for (const table of relatedTables) {
        console.log(`\nНастройка ${table.name}...`);
        
        const exists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [table.name]);
        
        if (exists.rows[0].exists) {
          // Проверяем, существует ли колонка
          const columnExists = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = $1 
              AND column_name = $2
            );
          `, [table.name, table.column]);
          
          if (columnExists.rows[0].exists) {
            // Удаляем старые constraint'ы
            const fkResult = await client.query(`
              SELECT constraint_name
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
              WHERE tc.table_name = $1
                AND tc.constraint_type = 'FOREIGN KEY'
                AND kcu.column_name = $2;
            `, [table.name, table.column]);
            
            for (const row of fkResult.rows) {
              try {
                await client.query(`ALTER TABLE ${table.name} DROP CONSTRAINT IF EXISTS ${row.constraint_name}`);
                console.log(`  Удален constraint: ${row.constraint_name}`);
              } catch (err) {
                console.warn(`  Не удалось удалить constraint:`, err.message);
              }
            }
            
            // Создаем новый с CASCADE
            try {
              await client.query(`
                ALTER TABLE ${table.name} 
                ADD CONSTRAINT fk_${table.name}_racket_id 
                FOREIGN KEY (${table.column}) 
                REFERENCES tennis_rackets(id) 
                ON DELETE CASCADE;
              `);
              console.log(`  ✅ CASCADE DELETE настроен для ${table.name}`);
            } catch (err) {
              if (err.message.includes('already exists')) {
                console.log(`  ℹ️  Constraint уже существует`);
              } else {
                console.warn(`  ⚠️  Не удалось создать constraint:`, err.message);
              }
            }
          } else {
            console.log(`  ℹ️  Колонка ${table.column} не существует`);
          }
        } else {
          console.log(`  ℹ️  Таблица ${table.name} не существует`);
        }
      }
      
      await client.query('COMMIT');
      console.log('\n✅ Настройка CASCADE DELETE завершена успешно!');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('\n❌ Ошибка при настройке CASCADE DELETE:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Запуск скрипта
if (require.main === module) {
  setupCascadeDelete()
    .then(() => {
      console.log('\n✨ Готово!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Критическая ошибка:', error);
      process.exit(1);
    });
}

module.exports = { setupCascadeDelete };
