import { colors } from './colors.js';

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  constructor() {
    this.frame = 0;
    this.timer = null;
    this.text = '';
  }

  start(text) {
    this.stop();
    this.text = text;
    process.stdout.write('\x1B[?25l');
    this.timer = setInterval(() => {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`${colors.tool(frames[this.frame])} ${this.text}`);
      this.frame = (this.frame + 1) % frames.length;
    }, 90);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write('\x1B[?25h');
  }

  succeed(text = this.text) {
    this.stop();
    console.log(`${colors.success('✔')} ${text}`);
  }

  fail(text = this.text) {
    this.stop();
    console.log(`${colors.error('✖')} ${text}`);
  }
}

export const spinner = new Spinner();
