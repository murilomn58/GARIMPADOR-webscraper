import pino from 'pino';
import dayjs from 'dayjs';
import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const logfile = path.join(logsDir, `run-${dayjs().format('YYYYMMDD-HHmmss')}.log`);

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
}, pino.destination({ dest: logfile, sync: false }));

export type LogLine = { level: 'info' | 'warn' | 'error'; msg: string; time: string };

export class MemoryLog {
  private lines: LogLine[] = [];
  push(level: LogLine['level'], msg: string) {
    const line = { level, msg, time: new Date().toISOString() } as LogLine;
    this.lines.push(line);
    if (this.lines.length > 3000) this.lines.shift();
  }
  list(lastN = 200) { return this.lines.slice(-lastN); }
  clear() { this.lines = []; }
}

export const memlog = new MemoryLog();

