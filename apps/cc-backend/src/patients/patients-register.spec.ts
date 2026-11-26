import { PatientsService } from './patients.service';

describe('PatientsService.registerNew', () => {
  const created: any[] = [];
  const patients = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(async ({ data }: any) => {
      const row = { id: 'p-new', ...data };
      created.push(row);
      return row;
    }),
  };
  const prisma = { patient: patients } as any;
  const svc = new PatientsService(prisma);

  beforeEach(() => {
    created.length = 0;
    patients.findUnique.mockReset();
    patients.findFirst.mockReset();
    patients.create.mockClear();
  });

  it('crea paciente nuevo cuando no existe DNI ni teléfono', async () => {
    patients.findUnique.mockResolvedValue(null);
    patients.findFirst.mockResolvedValue(null);
    const r = await svc.registerNew({
      firstName: 'Ana',
      lastName: 'Benítez',
      documentId: '99887766',
      phone: '70199887',
    });
    expect(r.created).toBe(true);
    expect(r.patient?.firstName).toBe('Ana');
    expect(patients.create).toHaveBeenCalled();
  });

  it('es idempotente por DNI', async () => {
    patients.findUnique.mockResolvedValue({
      id: 'p1',
      firstName: 'Ana',
      lastName: 'Benítez',
      documentId: '99887766',
    });
    const r = await svc.registerNew({
      firstName: 'Ana',
      lastName: 'Benítez',
      documentId: '99887766',
      phone: '70199887',
    });
    expect(r.created).toBe(false);
    expect(r.patient?.id).toBe('p1');
    expect(patients.create).not.toHaveBeenCalled();
  });

  it('es idempotente por teléfono', async () => {
    patients.findUnique.mockResolvedValue(null);
    patients.findFirst.mockResolvedValue({
      id: 'p2',
      firstName: 'Luis',
      lastName: 'Giménez',
      documentId: '111',
      phone: '5491155599887',
    });
    const r = await svc.registerNew({
      firstName: 'Otro',
      lastName: 'Nombre',
      documentId: '22223333',
      phone: '70199887',
    });
    expect(r.created).toBe(false);
    expect(r.patient?.id).toBe('p2');
    expect(patients.create).not.toHaveBeenCalled();
  });

  it('exige campos mínimos', async () => {
    const r = await svc.registerNew({
      firstName: '',
      lastName: 'X',
      documentId: '',
      phone: '',
    });
    expect(r.patient).toBeNull();
    expect(r.missing).toEqual(
      expect.arrayContaining(['firstName', 'documentId', 'phone']),
    );
  });
});
