import puppeteer from 'puppeteer';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
const CHAT_ID = process.env.CHAT_ID!;

const START_DATE = new Date('2025-08-10');
const MAX_DAYS_TO_CHECK = 20;
const LOG_PATH = path.resolve(__dirname, '../logs.txt');
const LAST_FOUND_PATH = path.resolve(__dirname, '../last-found.txt');

const bot = new TelegramBot(TELEGRAM_TOKEN);

function formatDateForURL(date: Date): string {
  return date.toLocaleDateString('ru-RU').replace(/\./g, '.');
}

function formatDateForSearch(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const monthsRod: string[] = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  const month = monthsRod[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}



function readLastFoundDate(): string | null {
  try {
    return fs.readFileSync(LAST_FOUND_PATH, 'utf8').trim();
  } catch {
    return null;
  }
}

function writeLastFoundDate(dateStr: string) {
  fs.writeFileSync(LAST_FOUND_PATH, dateStr, 'utf8');
}

async function checkTickets(): Promise<void> {
  const startTime = new Date();
  console.log(`🔍 [${startTime.toLocaleString()}] Начало проверки билетов...`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  try {
    await page.goto('https://grandtrain.ru', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    for (let i = 0; i < MAX_DAYS_TO_CHECK; i++) {
      const currentDate = new Date(START_DATE.getTime());
      currentDate.setDate(currentDate.getDate() - i); // 🔁 идём назад

      const urlDate = formatDateForURL(currentDate);
      const visibleDate = formatDateForSearch(currentDate);
      const url = `https://grandtrain.ru/tickets/2000000-2078750/${urlDate}/`;

      console.log(`➡️ Проверка: ${visibleDate} | URL: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 3000));

      const pageContent = await page.content();

      fs.writeFileSync(LOG_PATH, pageContent, 'utf8');
      console.log(`📝 HTML-контент перезаписан в logs.txt`);

      if (pageContent.includes(visibleDate) && pageContent.includes('Выбрать места')) {
        const lastFound = readLastFoundDate();
        if (lastFound !== visibleDate) {
          writeLastFoundDate(visibleDate);
          console.log(`✅ Новая дата найдена: ${visibleDate}, отправка уведомления...`);
          await bot.sendMessage(
            CHAT_ID,
            `🎟 Билеты на поезд Москва — Севастополь доступны на ${visibleDate}:\n${url}`
          );
        } else {
          console.log(`🔁 ${visibleDate} уже была отправлена ранее.`);
        }
        break;
      } else {
        console.log(`❌ Билетов на ${visibleDate} пока нет.`);
      }
    }

  } catch (error) {
    console.error('🚨 Ошибка при проверке:', error);
  } finally {
    await browser.close();
    const endTime = new Date();
    console.log(`✅ Проверка завершена. (${endTime.toLocaleTimeString()})\n`);
  }
}

// Проверка каждые 10 минут
setInterval(checkTickets, 1000 * 60 * 10);
checkTickets(); // Первый запуск сразу
