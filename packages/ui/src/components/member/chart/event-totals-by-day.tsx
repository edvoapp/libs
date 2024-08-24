import { config, globalStore, Model } from '@edvoapp/common';
import { Observable, useAwait, useObserve } from '@edvoapp/util';
import { DocumentIterator } from '../../../viewmodel/user/DocumentIterator';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  TimeScale,
  Title,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { eachDayOfInterval, eachWeekOfInterval, endOfDay, startOfDay, subDays } from 'date-fns';
import 'chartjs-adapter-date-fns';
import { TimelineEventType } from '@edvoapp/common/dist/model/timeline-event';
import { Spinner } from '../../../assets/vectors/spinner';

ChartJS.register(CategoryScale, LinearScale, TimeScale, PointElement, LineElement, Title, Tooltip, Legend);

export interface ChartConfig {
  event: TimelineEventType;
  byUser?: boolean;
}
type Props = {
  config: ChartConfig;
};

const firstCohortDate = new Date('2022-07-06');
const now = new Date();

const cohortDates = eachWeekOfInterval(
  {
    start: firstCohortDate,
    end: now,
  },
  { weekStartsOn: 3 },
); // make it wednesday

export const EventTotalsByDayChart = ({ config: chartConfig }: Props) => {
  const selectedCohortDate = useObserve(() => new Observable(cohortDates[cohortDates.length - 1]), []);
  const list = useAwait<{ x: Date; y: number }[]>(async () => {
    const numberOfDays = 15;
    const end = endOfDay(now);
    // const end = endOfDay(selectedCohortDate.value);

    const startDate = startOfDay(subDays(selectedCohortDate.value, numberOfDays));

    const interval = eachDayOfInterval({
      start: startDate,
      end,
    });

    // { "2022-07-11": { count: 10 } }
    const buckets: Record<string, { date: Date; count: number; users: Set<string> }> = {};

    for (const date of interval) {
      const d = date.toLocaleString();
      buckets[d] = { date, count: 0, users: new Set() };
    }

    let query = globalStore.createBasicQuery<Model.TimelineEventDataDB>('event');

    if (config.env === 'development') {
      query = query.where('userID', '==', globalStore.getCurrentUserID());
    }
    query = query.where('eventType', '==', chartConfig.event);
    query = query.where('isAnonymous', '==', false);
    query = query.orderBy('eventDate').startAt(startDate).endAt(end);

    const iter = new DocumentIterator<Model.TimelineEventDataDB, 'id'>(query, 'id');

    for await (const item of iter) {
      const data = item.docData;
      const date = startOfDay(globalStore.timestampToDate(data.eventDate));
      const d = date.toLocaleString();
      const userID = data.userID;
      const vertex = Model.Vertex.getById({ id: userID });
      const email = await (
        await vertex
          .filterProperties({ role: ['email'] })
          .firstObs()
          .get()
      )?.text.get();

      if (email?.includes('test') || email?.includes('edvo')) continue;

      const bucket = (buckets[d] ??= { date, count: 0, users: new Set() });
      bucket.count++;
      bucket.users.add(userID);

      // const bucketId = data.eventDate.toMillis() - startDate.valueOf();
    }

    return Object.entries(buckets).map(([_, val]) => {
      return {
        x: val.date,
        y: chartConfig.byUser ? val.users.size : val.count,
      };
    });
  }, [chartConfig, selectedCohortDate.value]);

  if (!list)
    return (
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
        }}
      >
        <Spinner className="animate-spin h-10 w-10 text-indigo-600 mb-3" />
      </div>
    );

  return (
    <div style={{ flex: 1 }}>
      <Line
        options={{
          responsive: true,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            x: {
              title: {
                display: false,
              },
              type: 'time',
              ticks: {
                source: 'data',
              },
              time: {
                tooltipFormat: 'LL/d',
                displayFormats: {
                  day: 'MMM dd',
                  hour: 'MMM dd',
                  minute: 'MMM dd',
                  second: 'MMM dd',
                },
              },
            },
            y: {
              title: {
                display: false,
              },
            },
          },
        }}
        data={{
          labels: [],
          datasets: [
            {
              data: list,
              borderColor: 'rgb(255, 99, 132)',
              backgroundColor: 'rgba(255, 99, 132, 0.5)',
            },
          ],
        }}
      />
      {/*<select*/}
      {/*  className="focus-target"*/}
      {/*  value={selectedCohortDate.value.toISOString()}*/}
      {/*  id="cohort-filter"*/}
      {/*  name="cohort-filter"*/}
      {/*  onChange={(e: any) => selectedCohortDate.set(new Date(e.target.value))}*/}
      {/*>*/}
      {/*  {cohortDates.map((date) => (*/}
      {/*    <option key={date.toISOString()} value={date.toISOString()}>*/}
      {/*      {format(date, 'MM/dd')}*/}
      {/*    </option>*/}
      {/*  ))}*/}
      {/*</select>*/}
    </div>
  );
};
