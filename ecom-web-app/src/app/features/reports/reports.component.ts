import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { ReportsDashboard } from '../../core/models/order.model';
import { OrderService } from '../../core/services/order.service';

Chart.register(...registerables);

@Component({
  selector: 'app-reports',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css',
})
export class ReportsComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly orderService = inject(OrderService);

  @ViewChild('revenueChart') revenueChartRef?: ElementRef<HTMLCanvasElement>;

  protected readonly isLoading = signal(true);
  protected readonly loadError = signal('');
  protected readonly dashboard = signal<ReportsDashboard | null>(null);

  private chart?: Chart;

  ngOnInit(): void {
    this.orderService.getReportsDashboard().subscribe({
      next: (response) => {
        this.dashboard.set(response.data);
        this.isLoading.set(false);
        setTimeout(() => this.renderChart(), 0);
      },
      error: () => {
        this.loadError.set('Unable to load reports.');
        this.isLoading.set(false);
      },
    });
  }

  ngAfterViewInit(): void {
    if (this.dashboard()) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    const canvas = this.revenueChartRef?.nativeElement;
    const data = this.dashboard()?.chart ?? [];

    if (!canvas) {
      return;
    }

    this.chart?.destroy();

    const labels = data.map((point) =>
      new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    );

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenue',
            data: data.map((point) => point.revenue),
            backgroundColor: '#1b4965',
            borderRadius: 6,
          },
          {
            label: 'Profit',
            data: data.map((point) => point.profit),
            backgroundColor: '#d4a373',
            borderRadius: 6,
          },
          {
            label: 'Discount',
            data: data.map((point) => point.discount),
            backgroundColor: '#9fb3c8',
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    };

    this.chart = new Chart(canvas, config);
  }
}
