import { Model, config, globalStore } from '@edvoapp/common';
import { useAwait } from '@edvoapp/util';
import { DocumentIterator } from '../../../viewmodel/user/DocumentIterator';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  TimeScale,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { eachDayOfInterval, subDays } from 'date-fns';
import 'chartjs-adapter-date-fns';

ChartJS.register(CategoryScale, LinearScale, TimeScale, PointElement, LineElement, Title, Tooltip, Legend);

export const ChartUserActivations = () => {
  const list = useAwait<{ x: Date; y: number }[]>(async () => {
    const numberOfDays = 15;
    var endDate = new Date();

    var startDate = subDays(endDate, numberOfDays);
    startDate.setHours(0, 0, 0, 0);

    const interval = eachDayOfInterval({ start: startDate, end: endDate });

    // { "2022-07-11": { count: 10 } }
    const buckets: Record<string, { date: Date; count: number; users: Set<string> }> = {};

    for (const date of interval) {
      const d = date.toLocaleString();
      buckets[d] = { date, count: 0, users: new Set() };
    }

    let query = globalStore.createQuery<Model.TimelineEventDataDB>('event');

    if (config.env === 'development') {
      query = query.where('userID', '==', globalStore.getCurrentUserID());
    }
    query = query.where('eventType', '==', 'created');
    query = query.orderBy('eventDate').startAt(startDate).endAt(endDate);

    const iter = new DocumentIterator(query, 'id');

    for await (const item of iter) {
      const data = item.docData;
      const date = globalStore.timestampToDate(data.eventDate);
      date.setHours(0, 0, 0, 0);
      const d = date.toLocaleString();

      const bucket = (buckets[d] ??= { date, count: 0, users: new Set() });
      bucket.count++;
      bucket.users.add(data.userID);

      // const bucketId = data.eventDate.toMillis() - startDate.valueOf();
    }

    return Object.entries(buckets).map(([_, val]) => {
      return {
        x: val.date,
        y: val.users.size,
      };
    });
  }, []);

  if (!list) return null; // TODO: Loading spinner
  return (
    <Line
      options={{
        responsive: true,
        plugins: {
          legend: {
            position: 'top' as const,
          },
          // title: {
          //   display: true,
          //   text: 'Chart.js Line Chart',
          // },
        },
        scales: {
          x: {
            type: 'time',
            ticks: {
              source: 'data',
            },
            time: {
              // Luxon format string
              tooltipFormat: 'LL/d',
              displayFormats: {
                day: 'MMM dd',
                // hour: 'MMM dd',
                // minute: 'MMM dd',
                // second: 'MMM dd',
              },
            },
            title: {
              display: true,
              text: 'Date',
            },
          },
          y: {
            title: {
              display: true,
              text: 'value',
            },
          },
        },
      }}
      data={{
        labels: [],
        datasets: [
          {
            label: 'DAU',
            data: list,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
          },
        ],
      }}
    />
  );
};
