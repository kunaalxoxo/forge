import { colors } from './colors.js';

export class Spinner {
  constructor() {
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.interval = null;
    this.currentFrame = 0;
    this.text = '';
  }

  start(text) {
    this.text = text;
    process.stdout.write('\x1B[?25l'); // Hide cursor
    this.interval = setInterval(() => {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`${colors.tool(this.frames[this.currentFrame])} ${this.text}`);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write('\x1B[?25h'); // Show cursor
    }
  }

  succeed(text) {
    this.stop();
    console.log(`${colors.success('✔')} ${text || this.text}`);
  }

  fail(text) {
    this.stop();
    console.log(`${colors.error('✖')} ${text || this.text}`);
  }
}

export const spinner = new Spinner();
