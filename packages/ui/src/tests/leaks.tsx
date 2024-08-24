import { globalStore, sleep } from '@edvoapp/common';
import { EdvoObj, useAwait } from '@edvoapp/util';

export const DiagLeaks = () => {
  // Wait one idle tick to make sure the previous page unloads
  const ready = useAwait(async () => {
    await sleep(0);
    return true;
  }, []);

  if (!ready) return null;

  return (
    <div style="display: flex; height: 100%; overflow: auto">
      <div style="flex: 1; height: 100vh; overflow: auto;">
        Queries still active: <span data-cy="active-queries">{globalStore.activeQueries.size}</span>
        <br />
        <table>
          <tr>
            <td>Query name</td>
            <td>Records</td>
          </tr>
          {[...globalStore.activeQueries].map((q) => (
            <tr>
              <td>{q.name}</td>
              <td>{q.length}</td>
            </tr>
          ))}
        </table>
      </div>
      <div style="flex: 1; height: 100vh; overflow: auto;">
        Transactions still active: <span data-cy="active-transactions">{globalStore.activeTransactions.count}</span>
        <br />
        <table>
          <tr>
            <td>Transaction name</td>
          </tr>
          {globalStore.activeTransactions.nameList.map((name) => (
            <tr>
              <td>{name}</td>
            </tr>
          ))}
        </table>
      </div>
      <div style="flex: 1; height: 100vh; overflow: auto;">
        Objects still resident: {EdvoObj.liveObjects}
        <br />
        <table>
          <tr>
            <td>Constructor</td>
            <td>Current</td>
            <td>Ever</td>
          </tr>
          {Object.entries(EdvoObj.liveObjectsByConstructor)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, stat]) => (
              <tr>
                <td>{name}</td>
                <td style="padding-left: 10px">{stat.current}</td>
                <td style="padding-left: 10px">{stat.ever}</td>
              </tr>
            ))}
        </table>
      </div>
    </div>
  );
};
