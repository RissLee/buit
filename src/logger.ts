import colors, { Color } from 'colors';
import moment from 'moment';

export const logger = {
  log(...text: string[]) {
    console.log(...text);
  },
  title(...text: string[]) {
    this.colorLog(colors.green, ...text);
  },
  info(...text: string[]) {
    this.colorLog(colors.blue, ...text);
  },
  error(...text: string[]) {
    this.colorLog(colors.red, ...text);
  },
  warn(...text: string[]) {
    this.colorLog(colors.yellow, ...text);
  },
  colorLog(color: Color, ...text: string[]) {
    console.log(`[${colors.gray(moment().format('HH:mm:ss'))}]`, ...text.map((t) => color(t)));
  },
};
