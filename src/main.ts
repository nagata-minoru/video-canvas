import './style.css';
import { CanvasController } from './canvas';
import { initControls } from './controls';

const canvasEl = document.getElementById('canvas') as HTMLDivElement;
const canvasController = new CanvasController(canvasEl, { width: 1080, height: 608 });

initControls(canvasController);
