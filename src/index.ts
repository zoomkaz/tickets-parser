import puppeteer from 'puppeteer';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
const CHAT_ID = process.env.CHAT_ID!;
const TARGET_DATE = '2025-08-10'; // ISO формат для удобства

const bot = new TelegramBot(TELEGRAM_TOKEN);
const MAX_DAYS_BEFORE = 15;

const BASE_URL = 'https://grandtrain.ru/tickets/2000000-2078750';

function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatURLDate(date: Date): string {
  return date.toISOString().split('T')[0].split('-').reverse().join('.');
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
    const startDate = new Date(TARGET_DATE);
    let ticketsFound = false;

    for (let offset = 0; offset <= MAX_DAYS_BEFORE; offset++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() - offset);

      const urlDate = formatURLDate(currentDate); // 10.08.2025
      const displayDate = formatDate(currentDate); // 10 августа 2025

      const url = `${BASE_URL}/${urlDate}/`;
      console.log(`🌐 Проверка: ${url}`);

      await page.goto(url, { waitUntil: 'networkidle2' });
      await page.waitForTimeout(5000);

      const content = await page.content();

      if (content.includes(displayDate) && content.includes('Выбрать места')) {
        await bot.sendMessage(
          CHAT_ID,
          `🎟 Билеты на поезд Москва — Севастополь на ${displayDate} доступны: ${url}`
        );
        console.log(`✅ Билеты найдены на ${displayDate}`);
        ticketsFound = true;
        break;
      } else {
        console.log(`❌ Билетов на ${displayDate} нет.`);
      }
    }

    if (!ticketsFound) {
      await bot.sendMessage(
        CHAT_ID,
        `🚫 Билеты на поезд Москва — Севастополь не найдены в течение ${MAX_DAYS_BEFORE} дней до 10 августа 2025.`
      );
      console.log(`📭 Билеты не найдены в течение ${MAX_DAYS_BEFORE} дней.`);
    }
  } catch (error) {
    console.error('🚨 Ошибка:', error);
  } finally {
    await browser.close();
    console.log(`✅ Проверка завершена.\n`);
  }
}

// Проверка каждые 10 минут
setInterval(checkTickets, 1000 * 60 * 10);
checkTickets();
