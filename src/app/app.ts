import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TuiButton, TuiRoot } from '@taiga-ui/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TuiRoot, TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.less',
})
export class App {
  protected readonly sections = [
    { path: '/new', title: 'Новая сессия' },
    { path: '/arena', title: 'Арена' },
    { path: '/workshop', title: 'Мастерская' },
    { path: '/report', title: 'Отчёт' },
    { path: '/history', title: 'История' },
  ] as const;
}
