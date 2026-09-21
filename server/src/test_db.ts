import { db, schema } from './db';
import { conciliacionService } from './modules/conciliacion/service';

async function test() {
  try {
    console.log('Fetching conciliaciones...');
    const list = await db.query.conciliaciones.findMany();
    console.log('List of conciliaciones:', list);
    if (list.length > 0) {
      const first = list[0];
      console.log('Fetching detail for id:', first.id);
      const detail = await conciliacionService.getById(first.id);
      console.log('Detail summary:', detail?.summary);
      console.log('Detail extractoMovs count:', detail?.extractoMovs?.length);
      console.log('Detail mayorMovs count:', detail?.mayorMovs?.length);
    }
  } catch (err) {
    console.error('Error in test:', err);
  }
}

test();
