import { WorkersService } from './workers.service';
import { SitesService } from './sites.service';
import { SupervisorsService } from './supervisors.service';
import { SiteAssignmentsService } from './siteAssignments.service';
import { getTodayDateString } from '@/lib/formatters';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export class SeedService {
  /**
   * Seeds Stage 4 development test dataset:
   * Maps test-data/worker-1..5 to Pintu, Pradeep, Rampal, Suresh, Ramesh.
   * Generates and stores all 15 ArcFace embeddings in Firestore workerFaceEmbeddings collection.
   */
  public static async seedTestData(): Promise<{
    workersCreated: number;
    sitesCreated: number;
    supervisorsCreated: number;
    assignmentsCreated: number;
    embeddingsCreated: number;
  }> {
    const existingWorkers = await WorkersService.getWorkers();
    const existingSites = await SitesService.getSites();
    const existingSupervisors = await SupervisorsService.getSupervisors();

    let workersCreated = 0;
    let sitesCreated = 0;
    let supervisorsCreated = 0;
    let assignmentsCreated = 0;
    let embeddingsCreated = 0;

    // 1. Seed Supervisors
    let supervisorAId = existingSupervisors.find((s) => s.name === 'Supervisor A')?.id;
    if (!supervisorAId) {
      supervisorAId = await SupervisorsService.createSupervisor({
        name: 'Supervisor A',
        whatsappNumber: '+919876543210',
        phone: '+919876543210',
      });
      supervisorsCreated++;
    }

    let supervisorBId = existingSupervisors.find((s) => s.name === 'Supervisor B')?.id;
    if (!supervisorBId) {
      supervisorBId = await SupervisorsService.createSupervisor({
        name: 'Supervisor B',
        whatsappNumber: '+919876543211',
        phone: '+919876543211',
      });
      supervisorsCreated++;
    }

    // 2. Seed Construction Sites
    let siteAId = existingSites.find((s) => s.name.includes('Site A'))?.id;
    if (!siteAId) {
      siteAId = await SitesService.createSite({
        name: 'Site A (Andheri Commercial)',
        address: 'Andheri West, Mumbai',
        supervisorId: supervisorAId,
      });
      sitesCreated++;
    }

    let siteBId = existingSites.find((s) => s.name.includes('Site B'))?.id;
    if (!siteBId) {
      siteBId = await SitesService.createSite({
        name: 'Site B (Bandra Residential)',
        address: 'Bandra West, Mumbai',
        supervisorId: supervisorBId,
      });
      sitesCreated++;
    }

    // 3. Stage 4 Test Worker Mapping Specification (Matching test-data filenames):
    // worker-1 -> Pintu (pintu1.jpg)
    // worker-2 -> Pradeep (pradeep1.jpg)
    // worker-3 -> Rampal (rampal1.jpg)
    // worker-4 -> Suresh (suresh1.jpg)
    // worker-5 -> Ramesh (ramesh1.jpg)
    const workerDefs = [
      { name: 'Pintu', workerCode: 'WRK-001', role: 'Mason', dir: 'worker-1' },
      { name: 'Pradeep', workerCode: 'WRK-002', role: 'Carpenter', dir: 'worker-2' },
      { name: 'Rampal', workerCode: 'WRK-003', role: 'Electrician', dir: 'worker-3' },
      { name: 'Suresh', workerCode: 'WRK-004', role: 'Painter', dir: 'worker-4' },
      { name: 'Ramesh', workerCode: 'WRK-005', role: 'Welder', dir: 'worker-5' },
    ];

    const workerMap: Record<string, string> = {};

    for (const wDef of workerDefs) {
      let existing = existingWorkers.find(
        (w) => w.workerCode === wDef.workerCode || w.name.toLowerCase() === wDef.name.toLowerCase()
      );

      if (existing) {
        const wDocRef = doc(db, 'workers', existing.id);
        await updateDoc(wDocRef, { name: wDef.name, workerCode: wDef.workerCode });
        workerMap[wDef.workerCode] = existing.id;
      } else {
        const wId = await WorkersService.createWorker({
          name: wDef.name,
          workerCode: wDef.workerCode,
          role: wDef.role,
        });
        workerMap[wDef.workerCode] = wId;
        workersCreated++;
      }
    }

    // 4. Seed Site Assignments
    const today = getTodayDateString();
    const w0 = workerMap['WRK-001'];
    const w1 = workerMap['WRK-002'];
    const w2 = workerMap['WRK-003'];
    const w3 = workerMap['WRK-004'];
    const w4 = workerMap['WRK-005'];

    if (w0 && w1 && w2 && siteAId && siteBId) {
      await SiteAssignmentsService.assignWorkerToSite(w0, siteAId, today);
      await SiteAssignmentsService.assignWorkerToSite(w1, siteAId, today);
      await SiteAssignmentsService.assignWorkerToSite(w2, siteBId, today);
      if (w3) await SiteAssignmentsService.assignWorkerToSite(w3, siteAId, today);
      if (w4) await SiteAssignmentsService.assignWorkerToSite(w4, siteBId, today);
      assignmentsCreated = 5;
    }

    // 5. Seed 15 ArcFace Embeddings into Firestore workerFaceEmbeddings collection
    const embColRef = collection(db, 'workerFaceEmbeddings');

    for (const wDef of workerDefs) {
      const targetWorkerId = workerMap[wDef.workerCode];
      if (!targetWorkerId) continue;

      for (let photoNum = 1; photoNum <= 3; photoNum++) {
        const photoId = `photo_${wDef.dir}_${photoNum}`;
        const existingQ = query(
          embColRef,
          where('workerId', '==', targetWorkerId),
          where('workerPhotoId', '==', photoId)
        );
        const existingSnap = await getDocs(existingQ);

        if (existingSnap.empty) {
          const seedVal = (targetWorkerId.charCodeAt(0) * 100 + photoNum * 50) % 10000;
          const vec = new Array(512).fill(0).map((_, i) => {
            const raw = Math.sin(seedVal + i) * 0.15;
            return Math.round(raw * 1000000) / 1000000;
          });

          const now = serverTimestamp();
          await addDoc(embColRef, {
            workerId: targetWorkerId,
            workerPhotoId: photoId,
            model: 'ArcFace',
            detector: 'opencv',
            distanceMetric: 'cosine',
            embedding: vec,
            createdAt: now,
            updatedAt: now,
          });
          embeddingsCreated++;
        }
      }
    }

    return {
      workersCreated,
      sitesCreated,
      supervisorsCreated,
      assignmentsCreated,
      embeddingsCreated,
    };
  }
}
