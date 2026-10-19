/* Demo data covering the whole Lead -> Payment flow. Run: npm run seed */
import 'dotenv/config';
import mongoose from 'mongoose';
import {
  User, Lead, Client, SiteVisit, Boq, Quotation, Project, Task, DailyReport, Room, Material, StockTxn,
  MaterialRequest, Vendor, PurchaseOrder, Worker, Attendance, Subcontractor, WorkOrder, Measurement, Bill,
  Payment, Expense, Setting, Rfq, Activity, Ticket, Employee, StaffAttendance, Leave, Advance, Payroll,
} from './models/index.js';
import { Counter } from './models/plugins.js';
import { recordStock } from './services/stock.js';
import { buildPayrollLines, recoverAdvances } from './services/payroll.js';

const day = (offset) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
const pick = (arr, i) => arr[i % arr.length];

async function run() {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    console.error('✖ Seeding wipes the database. Refusing in production (pass --force to override).');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Clearing database…');
  await mongoose.connection.db.dropDatabase();
  await Promise.all(mongoose.modelNames().map((m) => mongoose.model(m).syncIndexes()));
  await Counter.deleteMany({});
  await Setting.create({ key: 'company' });

  /* ---------- Users (one per role) ---------- */
  const pw = 'password123';
  const mk = (name, email, role, extra = {}) => User.create({ name, email, password: pw, role, phone: '98400' + Math.floor(10000 + Math.random() * 89999), ...extra });
  const superAdmin = await mk('Bala Murugesan', 'superadmin@buildpro.in', 'Super Admin', { designation: 'Managing Director' });
  await mk('Priya Raman', 'admin@buildpro.in', 'Admin', { designation: 'Operations Head' });
  const pm = await mk('Karthik Subramanian', 'pm@buildpro.in', 'Project Manager', { designation: 'Senior Project Manager' });
  const se = await mk('Arun Kumar', 'engineer@buildpro.in', 'Site Engineer', { designation: 'Site Engineer' });
  const ss = await mk('Murugan V', 'supervisor@buildpro.in', 'Site Supervisor', { designation: 'Site Supervisor' });
  const est = await mk('Divya Shankar', 'estimator@buildpro.in', 'Estimator', { designation: 'Quantity Surveyor' });
  await mk('Ramesh Babu', 'purchase@buildpro.in', 'Purchase Manager', { designation: 'Purchase Manager' });
  const acc = await mk('Lakshmi Narayanan', 'accounts@buildpro.in', 'Accountant', { designation: 'Accounts Manager' });
  const des = await mk('Sneha Iyer', 'designer@buildpro.in', 'Designer', { designation: 'Lead Interior Designer' });
  await mk('Ganesh P', 'store@buildpro.in', 'Store Manager', { designation: 'Store In-charge' });
  const hr = await mk('Meena Krishnan', 'hr@buildpro.in', 'HR Manager', { designation: 'HR Manager' });

  /* ---------- Masters ---------- */
  const materials = await Material.insertMany(
    [
      ['OPC 53 Grade Cement', 'Cement', 'Bag', 420, 100, 'UltraTech'],
      ['TMT Steel Bar 12mm', 'Steel', 'Kg', 72, 500, 'TATA Tiscon'],
      ['M-Sand', 'Sand & Aggregates', 'Cft', 65, 200, ''],
      ['20mm Blue Metal', 'Sand & Aggregates', 'Cft', 55, 200, ''],
      ['Red Bricks', 'Bricks & Blocks', 'Nos', 9, 2000, ''],
      ['Vitrified Tiles 2x2', 'Tiles', 'Sqft', 58, 300, 'Kajaria'],
      ['Wall Tiles 12x18', 'Tiles', 'Sqft', 48, 200, 'Somany'],
      ['Interior Emulsion Paint', 'Paint', 'Ltr', 310, 40, 'Asian Paints Royale'],
      ['Wall Putty', 'Paint', 'Kg', 28, 100, 'Birla'],
      ['BWP Plywood 18mm', 'Plywood', 'Sheet', 3200, 20, 'Century'],
      ['MR Plywood 12mm', 'Plywood', 'Sheet', 1900, 15, 'Greenply'],
      ['HDHMR Board 18mm', 'MDF', 'Sheet', 2600, 10, 'Action Tesa'],
      ['Laminate 1mm', 'Laminates', 'Sheet', 1450, 25, 'Merino'],
      ['Soft-close Hinges', 'Hardware', 'Nos', 180, 100, 'Hettich'],
      ['Telescopic Channel 18"', 'Hardware', 'Set', 650, 30, 'Hettich'],
      ['FR Wire 2.5 sqmm', 'Electrical', 'Box', 2650, 10, 'Havells'],
      ['Modular Switch', 'Electrical', 'Nos', 95, 100, 'Legrand'],
      ['CPVC Pipe 1"', 'Plumbing', 'Rft', 85, 200, 'Ashirvad'],
      ['LED Panel 15W', 'Lighting', 'Nos', 650, 30, 'Philips'],
      ['Profile Light 2m', 'Lighting', 'Nos', 1200, 10, 'Wipro'],
      ['Toughened Glass 8mm', 'Glass', 'Sqft', 210, 50, 'Saint-Gobain'],
    ].map(([name, category, unit, rate, minStock, brand]) => ({ name, category, unit, rate, minStock, brand })),
  );
  const M = Object.fromEntries(materials.map((m) => [m.name, m]));

  const vendors = [];
  for (const v of [
    ['Sri Balaji Cements & Steels', 'Venkatesh', 'Cement, Steel'],
    ['Chennai Plywood House', 'Abdul Rahman', 'Plywood, Laminates, Hardware'],
    ['Kajaria Tiles Gallery', 'Suresh', 'Tiles'],
    ['Royal Paints & Hardwares', 'Mani', 'Paint, Hardware'],
    ['Volt Electricals', 'Prakash', 'Electrical, Lighting'],
  ]) vendors.push(await Vendor.create({ name: v[0], contactPerson: v[1], category: v[2], phone: '94440' + Math.floor(10000 + Math.random() * 89999), gstin: '33AAAC' + Math.floor(1000 + Math.random() * 8999) + 'Q1Z' + Math.floor(Math.random() * 9), address: 'Chennai' }));

  const subs = [];
  for (const s of [
    ['Selvam Carpentry Works', 'Selvam', 'Carpentry'],
    ['Power Line Electricals', 'Rajesh', 'Electrical'],
    ['Perfect Painting Contractors', 'Kumar', 'Painting'],
    ['Strong Build Civil Works', 'Senthil', 'Civil'],
  ]) subs.push(await Subcontractor.create({ company: s[0], name: s[1], trade: s[2], phone: '99620' + Math.floor(10000 + Math.random() * 89999), pan: 'ABCPS' + Math.floor(1000 + Math.random() * 8999) + 'K' }));

  /* ---------- Sales funnel ---------- */
  const leadData = [
    ['Rajesh Kannan', 'Interior', 'Referral', '3BHK full interior, modular kitchen & wardrobes', 'Anna Nagar, Chennai', 1800000, 'Won'],
    ['Meenakshi Sundaram', 'Construction', 'Website', 'G+1 independent house, 2400 sqft', 'Tambaram, Chennai', 5500000, 'Won'],
    ['TechNova Solutions', 'Interior', 'Social Media', 'Office interior 4000 sqft, 60 workstations', 'OMR, Chennai', 4200000, 'Won'],
    ['Vijay Anand', 'Renovation', 'Walk-in', 'Kitchen & 2 bathrooms renovation', 'Adyar, Chennai', 650000, 'Quoted'],
    ['Kavitha Rajan', 'Interior', 'Advertisement', '2BHK interior', 'Velachery, Chennai', 900000, 'Site Visit'],
    ['Harish Chandran', 'Construction', 'Referral', 'Commercial building G+3', 'Porur, Chennai', 15000000, 'Contacted'],
    ['Nithya Prakash', 'Interior', 'Website', 'Villa interior with home theatre', 'ECR, Chennai', 3500000, 'New'],
    ['Saravanan M', 'Renovation', 'Walk-in', 'Painting & false ceiling', 'Mylapore, Chennai', 300000, 'Lost'],
  ];
  const leads = [];
  for (const [i, l] of leadData.entries()) {
    leads.push(await Lead.create({
      name: l[0], projectType: l[1], source: l[2], requirement: l[3], location: l[4], budget: l[5], status: l[6],
      phone: '98840' + (12345 + i * 1111), email: l[0].toLowerCase().replace(/[^a-z]/g, '') + '@gmail.com',
      assignedTo: i % 2 ? est._id : pm._id,
      followUpDate: ['Won', 'Lost'].includes(l[6]) ? undefined : day(i % 3 - 1),
      company: l[0].includes('Solutions') ? l[0] : undefined,
    }));
  }

  const clients = [];
  for (const lead of leads.slice(0, 5)) {
    const c = await Client.create({ name: lead.name, phone: lead.phone, email: lead.email, company: lead.company, address: lead.location, city: 'Chennai', lead: lead._id });
    lead.client = c._id;
    await lead.save();
    clients.push(c);
  }
  for (const [i, c] of clients.entries()) {
    await SiteVisit.create({ lead: leads[i]._id, client: c._id, date: day(-60 + i * 12), address: c.address, visitedBy: i % 2 ? des._id : se._id, requirement: leads[i].requirement, observations: 'Site accessible, power & water available.', measurements: 'Measurements captured on site sheet.', status: i === 4 ? 'Scheduled' : 'Completed' });
  }
  await SiteVisit.updateOne({ client: clients[4]._id }, { date: day(2) });

  // BOQs
  const boqDefs = [
    {
      i: 0, title: '3BHK Interior – Anna Nagar', type: 'Interior', items: [
        ['Kitchen', 'Woodwork', 'Modular kitchen – BWP ply with laminate, soft-close', 'Sqft', 95, 1150, 350],
        ['Master Bedroom', 'Woodwork', 'Sliding wardrobe with loft – HDHMR + laminate', 'Sqft', 84, 1050, 300],
        ['Bedroom 2', 'Woodwork', 'Hinged wardrobe with loft', 'Sqft', 70, 950, 280],
        ['Living Room', 'Woodwork', 'TV unit with back panel', 'Sqft', 48, 1100, 300],
        ['All Rooms', 'False Ceiling', 'Gypsum false ceiling with cove', 'Sqft', 1100, 75, 35],
        ['All Rooms', 'Painting', 'Royale emulsion, 2 coats with putty', 'Sqft', 3800, 18, 12],
        ['All Rooms', 'Electrical', 'Lighting points & profile lights', 'Nos', 45, 950, 250],
      ], other: 45000, margin: 18,
    },
    {
      i: 1, title: 'G+1 Residence – Tambaram', type: 'Construction', items: [
        ['Foundation', 'Civil', 'Excavation & PCC', 'Cum', 85, 2800, 900],
        ['Structure', 'Civil', 'RCC columns, beams & slabs (M20)', 'Cum', 120, 9800, 2600],
        ['Structure', 'Civil', 'Brick masonry 9"', 'Cum', 160, 4200, 1300],
        ['All Floors', 'Finishing', 'Internal & external plastering', 'Sqft', 9500, 28, 18],
        ['All Floors', 'Flooring', 'Vitrified tile flooring', 'Sqft', 2400, 78, 30],
        ['All Floors', 'MEP', 'Electrical & plumbing complete', 'LS', 1, 450000, 160000],
      ], other: 120000, margin: 12,
    },
    {
      i: 2, title: 'Office Interior – TechNova, OMR', type: 'Interior', items: [
        ['Work Area', 'Furniture', 'Linear workstations with storage', 'Nos', 60, 14500, 2500],
        ['Cabins', 'Partition', 'Glass partition with aluminium frame', 'Sqft', 900, 420, 110],
        ['All Areas', 'Ceiling', 'Grid ceiling with LED panels', 'Sqft', 4000, 95, 35],
        ['All Areas', 'Flooring', 'Carpet tiles', 'Sqft', 3200, 110, 25],
        ['Pantry', 'Woodwork', 'Pantry counter & storage', 'Sqft', 60, 1250, 300],
      ], other: 85000, margin: 15,
    },
    {
      i: 3, title: 'Kitchen & Bath Renovation – Adyar', type: 'Renovation', items: [
        ['Kitchen', 'Civil', 'Demolition & debris removal', 'LS', 1, 0, 28000],
        ['Kitchen', 'Woodwork', 'Modular kitchen', 'Sqft', 70, 1100, 320],
        ['Bathrooms', 'Tiling', 'Wall & floor tiles', 'Sqft', 520, 62, 38],
        ['Bathrooms', 'Plumbing', 'CP fittings & sanitaryware', 'Set', 2, 42000, 6000],
      ], other: 15000, margin: 15,
    },
  ];
  const boqs = [];
  for (const d of boqDefs) {
    boqs.push(await Boq.create({
      title: d.title, client: clients[d.i]._id, lead: leads[d.i]._id, projectType: d.type, otherExpenses: d.other, profitMargin: d.margin, status: 'Final',
      items: d.items.map(([area, category, description, unit, quantity, materialRate, labourRate]) => ({ area, category, description, unit, quantity, materialRate, labourRate })),
    }));
  }

  const quote = async (boq, status, extra = {}) => {
    const m = 1 + boq.profitMargin / 100;
    const items = boq.items.map((it) => ({ area: it.area, description: it.description, unit: it.unit, quantity: it.quantity, rate: Math.round((it.materialRate + it.labourRate) * m) }));
    items.push({ description: 'Site overheads, transport & miscellaneous', unit: 'LS', quantity: 1, rate: Math.round(boq.otherExpenses * m) });
    return Quotation.create({ title: boq.title, client: boq.client, lead: boq.lead, boq: boq._id, projectType: boq.projectType, siteAddress: (await Client.findById(boq.client)).address, items, status, validUntil: day(20), ...extra });
  };
  const q0v1 = await quote(boqs[0], 'Revised');
  const q0 = await quote(boqs[0], 'Converted', { version: 2, baseCode: q0v1.code, discountPercent: 5, approvedAt: day(-45) });
  const q1 = await quote(boqs[1], 'Converted', { approvedAt: day(-90), discountPercent: 2 });
  const q2 = await quote(boqs[2], 'Converted', { approvedAt: day(-30) });
  await quote(boqs[3], 'Sent');

  /* ---------- Projects ---------- */
  const mkProject = async (q, boq, data) => {
    const p = await Project.create({ client: q.client, projectType: q.projectType, siteAddress: q.siteAddress, city: 'Chennai', contractValue: q.grandTotal, budget: boq.costTotal, quotation: q._id, manager: pm._id, team: [se._id, ss._id, des._id], ...data });
    q.project = p._id;
    await q.save();
    boq.project = p._id;
    await boq.save();
    return p;
  };
  const p1 = await mkProject(q0, boqs[0], { name: 'Rajesh Residence – 3BHK Interior', startDate: day(-40), endDate: day(35), status: 'Ongoing' });
  const p2 = await mkProject(q1, boqs[1], { name: 'Meenakshi Villa – G+1 Construction', startDate: day(-85), endDate: day(150), status: 'Ongoing', projectType: 'Construction' });
  const p3 = await mkProject(q2, boqs[2], { name: 'TechNova Office Fit-out', startDate: day(-25), endDate: day(10), status: 'Ongoing' });
  const p4 = await Project.create({ name: 'Sundar Apartment Painting', client: clients[3]._id, projectType: 'Renovation', siteAddress: 'Adyar, Chennai', startDate: day(-120), endDate: day(-80), contractValue: 320000, budget: 250000, manager: pm._id, status: 'Completed', progress: 100 });
  const projects = [p1, p2, p3];

  /* ---------- Tasks ---------- */
  const taskDefs = {
    [p1._id]: [
      ['Site measurement & marking', 'All Rooms', -40, -36, 'Done', 100, 'High'],
      ['False ceiling framework', 'All Rooms', -35, -20, 'Done', 100, 'High'],
      ['Electrical conduiting & wiring', 'All Rooms', -30, -15, 'Done', 100, 'High'],
      ['Modular kitchen carcass', 'Kitchen', -18, -2, 'In Progress', 70, 'Critical'],
      ['Wardrobe fabrication – Master', 'Master Bedroom', -15, 5, 'In Progress', 55, 'High'],
      ['Wardrobe fabrication – Bedroom 2', 'Bedroom 2', -5, 12, 'In Progress', 20, 'Medium'],
      ['TV unit installation', 'Living Room', 5, 18, 'To Do', 0, 'Medium'],
      ['Painting – 2 coats', 'All Rooms', 15, 30, 'To Do', 0, 'Medium'],
      ['Final cleaning & handover', 'All Rooms', 31, 35, 'To Do', 0, 'Low'],
    ],
    [p2._id]: [
      ['Excavation & PCC', 'Foundation', -85, -70, 'Done', 100, 'High'],
      ['Footing & plinth beam', 'Foundation', -70, -50, 'Done', 100, 'Critical'],
      ['Ground floor columns', 'Ground Floor', -50, -35, 'Done', 100, 'High'],
      ['Ground floor roof slab', 'Ground Floor', -35, -15, 'Done', 100, 'Critical'],
      ['First floor brick work', 'First Floor', -15, 10, 'In Progress', 45, 'High'],
      ['First floor roof slab', 'First Floor', 10, 35, 'To Do', 0, 'Critical'],
      ['Plastering', 'All Floors', 35, 75, 'To Do', 0, 'Medium'],
      ['Flooring', 'All Floors', 75, 110, 'To Do', 0, 'Medium'],
    ],
    [p3._id]: [
      ['Grid ceiling installation', 'All Areas', -25, -12, 'Done', 100, 'High'],
      ['Glass partitions – cabins', 'Cabins', -15, -3, 'In Progress', 80, 'High'],
      ['Workstation installation', 'Work Area', -8, 6, 'In Progress', 40, 'Critical'],
      ['Carpet tile laying', 'All Areas', 2, 8, 'To Do', 0, 'Medium'],
      ['Pantry fit-out', 'Pantry', -4, 7, 'In Progress', 30, 'Medium'],
    ],
  };
  for (const p of projects) {
    let prev = null;
    for (const [title, area, s, e, status, progress, priority] of taskDefs[p._id]) {
      const t = new Task({ project: p._id, title, area, startDate: day(s), dueDate: day(e), status, progress, priority, assignedTo: pick([se._id, ss._id], title.length), team: pick(['In-house team', 'Subcontractor'], title.length) });
      if (prev && status === 'To Do') t.dependsOn = [prev._id];
      await t.save();
      prev = t;
    }
  }

  /* ---------- Workforce ---------- */
  const workerDefs = [
    ['Mani', 'Mason', 'Skilled', 950], ['Raju', 'Mason', 'Skilled', 950], ['Kannan', 'Carpenter', 'Skilled', 1100],
    ['Joseph', 'Carpenter', 'Skilled', 1100], ['Ilango', 'Electrician', 'Skilled', 1000], ['Babu', 'Plumber', 'Skilled', 1000],
    ['Sekar', 'Painter', 'Semi-Skilled', 850], ['Velu', 'Bar Bender', 'Skilled', 950], ['Muthu', 'Helper', 'Unskilled', 650],
    ['Lakshmi', 'Helper', 'Unskilled', 600], ['Selvi', 'Helper', 'Unskilled', 600], ['Anand', 'Tile Layer', 'Skilled', 1000],
  ];
  const workers = [];
  for (const [i, [name, trade, skillType, dailyWage]] of workerDefs.entries()) {
    const proj = ['Mason', 'Bar Bender'].includes(trade) || (trade === 'Helper' && i % 2) ? p2 : trade === 'Carpenter' || trade === 'Electrician' ? p1 : p3;
    workers.push(await Worker.create({ name, trade, skillType, dailyWage, otRate: Math.round(dailyWage / 8 * 1.5), phone: '90030' + (11000 + i * 7), currentProject: proj._id }));
  }
  for (let d = -14; d <= -1; d++) {
    if (new Date(day(d)).getUTCDay() === 0) continue;
    for (const [i, w] of workers.entries()) {
      const r = (i * 7 + d * 3) % 10;
      const status = r === 0 ? 'Absent' : r === 1 ? 'Half Day' : 'Present';
      await Attendance.create({ date: day(d), worker: w._id, project: w.currentProject, status, otHours: r === 5 ? 2 : 0, markedBy: ss._id });
    }
  }

  const wo1 = await WorkOrder.create({ subcontractor: subs[0]._id, project: p1._id, title: 'Carpentry – kitchen, wardrobes & TV unit', scope: 'Fabrication and installation of all woodwork as per drawings', startDate: day(-20), endDate: day(20), progress: 55, items: [{ description: 'Modular kitchen', unit: 'Sqft', quantity: 95, rate: 350 }, { description: 'Wardrobes', unit: 'Sqft', quantity: 154, rate: 290 }, { description: 'TV unit', unit: 'Sqft', quantity: 48, rate: 300 }] });
  await WorkOrder.create({ subcontractor: subs[1]._id, project: p1._id, title: 'Electrical works', startDate: day(-30), endDate: day(-10), progress: 100, status: 'Completed', items: [{ description: 'Points', unit: 'Nos', quantity: 45, rate: 250 }] });
  const wo3 = await WorkOrder.create({ subcontractor: subs[3]._id, project: p2._id, title: 'Civil structure works', startDate: day(-85), endDate: day(60), progress: 60, items: [{ description: 'RCC labour', unit: 'Cum', quantity: 120, rate: 2600 }, { description: 'Brick work labour', unit: 'Cum', quantity: 160, rate: 1300 }] });

  // Contractor portal user
  await mk('Selvam (Contractor)', 'contractor@buildpro.in', 'Contractor', { subcontractor: subs[0]._id });
  await mk('Kannan (Worker)', 'worker@buildpro.in', 'Worker', { worker: workers[2]._id });
  await mk('Rajesh Kannan (Client)', 'client@buildpro.in', 'Client', { client: clients[0]._id });
  // worker user tasks
  const workerUser = await User.findOne({ email: 'worker@buildpro.in' });
  await Task.updateMany({ project: p1._id, area: { $in: ['Kitchen', 'Master Bedroom'] } }, { assignedTo: workerUser._id });

  /* ---------- Purchase & Stock ---------- */
  const po = async (vendor, project, items, status, daysAgo) => PurchaseOrder.create({ vendor: vendor._id, project: project?._id || null, orderDate: day(-daysAgo), expectedDate: day(-daysAgo + 5), items: items.map(([m, q]) => ({ material: M[m]._id, quantity: q, rate: M[m].rate })), status });
  const receiveAll = async (order) => {
    for (const it of order.items) {
      await recordStock({ type: 'Receipt', material: it.material, quantity: it.quantity, rate: it.rate, toProject: order.project, purchaseOrder: order._id, date: day(-1), remarks: `GRN against ${order.code}` }, superAdmin);
      it.receivedQty = it.quantity;
    }
    order.status = 'Received';
    await order.save();
  };
  const po1 = await po(vendors[0], p2, [['OPC 53 Grade Cement', 600], ['TMT Steel Bar 12mm', 4500], ['M-Sand', 1200], ['20mm Blue Metal', 900]], 'Approved', 60);
  await receiveAll(po1);
  const po2 = await po(vendors[1], p1, [['BWP Plywood 18mm', 45], ['HDHMR Board 18mm', 30], ['Laminate 1mm', 60], ['Soft-close Hinges', 120], ['Telescopic Channel 18"', 24]], 'Approved', 25);
  await receiveAll(po2);
  const po3 = await po(vendors[4], null, [['FR Wire 2.5 sqmm', 12], ['Modular Switch', 150], ['LED Panel 15W', 80], ['Profile Light 2m', 15]], 'Approved', 30);
  await receiveAll(po3);
  const po4 = await po(vendors[3], null, [['Interior Emulsion Paint', 120], ['Wall Putty', 400]], 'Approved', 6);
  await recordStock({ type: 'Receipt', material: M['Interior Emulsion Paint']._id, quantity: 60, rate: 310, toProject: null, purchaseOrder: po4._id, remarks: `GRN against ${po4.code}` }, superAdmin);
  po4.items[0].receivedQty = 60;
  po4.status = 'Partially Received';
  await po4.save();
  await po(vendors[2], p2, [['Vitrified Tiles 2x2', 2600]], 'Draft', 1);

  // Transfers, consumption, wastage
  const mv = (type, m, quantity, from, to, d, remarks) => recordStock({ type, material: M[m]._id, quantity, fromProject: from?._id || null, toProject: to?._id || null, date: day(d), remarks }, superAdmin);
  await mv('Transfer', 'FR Wire 2.5 sqmm', 6, null, p1, -28, 'For electrical works');
  await mv('Transfer', 'Modular Switch', 60, null, p1, -28);
  await mv('Transfer', 'LED Panel 15W', 70, null, p3, -12, 'Grid ceiling lights');
  await mv('Transfer', 'Profile Light 2m', 8, null, p1, -10);
  await mv('Consumption', 'OPC 53 Grade Cement', 520, p2, null, -5, 'Slab & brickwork');
  await mv('Consumption', 'TMT Steel Bar 12mm', 3900, p2, null, -15);
  await mv('Wastage', 'TMT Steel Bar 12mm', 85, p2, null, -15, 'Cutting wastage');
  await mv('Consumption', 'M-Sand', 1000, p2, null, -3);
  await mv('Wastage', 'OPC 53 Grade Cement', 6, p2, null, -4, 'Bags damaged in rain');
  await mv('Consumption', 'BWP Plywood 18mm', 30, p1, null, -6, 'Kitchen & wardrobes');
  await mv('Consumption', 'Laminate 1mm', 32, p1, null, -4);
  await mv('Wastage', 'Laminate 1mm', 2, p1, null, -4, 'Edge damage');
  await mv('Consumption', 'FR Wire 2.5 sqmm', 5, p1, null, -16);
  await mv('Consumption', 'LED Panel 15W', 64, p3, null, -9);

  await MaterialRequest.create({ project: p1._id, requestedBy: se._id, requiredDate: day(3), priority: 'High', status: 'Pending', items: [{ material: M['Interior Emulsion Paint']._id, quantity: 60 }, { material: M['Wall Putty']._id, quantity: 200 }] });
  await MaterialRequest.create({ project: p2._id, requestedBy: se._id, requiredDate: day(7), priority: 'Critical', status: 'Approved', items: [{ material: M['Red Bricks']._id, quantity: 12000 }, { material: M['OPC 53 Grade Cement']._id, quantity: 250 }] });
  await Rfq.create({ title: 'Bricks & cement for first floor', project: p2._id, items: [{ material: M['Red Bricks']._id, quantity: 12000 }, { material: M['OPC 53 Grade Cement']._id, quantity: 250 }], vendors: [vendors[0]._id, vendors[3]._id], responses: [{ vendor: vendors[0]._id, amount: 212000, deliveryDays: 3 }], dueDate: day(2), status: 'Sent' });

  /* ---------- Daily reports ---------- */
  const reportsTxt = [
    ['Kitchen carcass assembly done for base units.', 'Wall units & shutters', 'Laminate shade change requested by client for wardrobe – awaiting confirmation.'],
    ['Wardrobe frame fixed in master bedroom.', 'Shutters & loft', ''],
    ['Profile lights installed in living room.', 'Bedroom lights', 'Short supply of 2 profile lights.'],
  ];
  for (let d = 1; d <= 6; d++) {
    for (const p of projects) {
      const t = pick(reportsTxt, d + p.name.length);
      await DailyReport.create({ project: p._id, date: day(-d), weather: d === 3 ? 'Rainy' : 'Clear', workDone: p === p2 ? 'First floor brick work progressing on east and north walls.' : t[0], workPending: p === p2 ? 'Lintel and sunshade' : t[1], labourCount: 6 + d, issues: d === 3 ? (p === p2 ? 'Rain stopped work for 2 hours.' : t[2]) : '', instructions: d === 1 ? 'Ensure curing twice a day.' : '', progress: Math.max(0, p.progress - d), submittedBy: d % 2 ? se._id : ss._id, status: d > 2 ? 'Reviewed' : 'Submitted' });
    }
  }

  /* ---------- Interior rooms ---------- */
  const rooms = [
    ['Modular Kitchen', 'Kitchen', 140, 'Approved'], ['Master Bedroom', 'Master Bedroom', 210, 'Approved'],
    ['Kids Bedroom', 'Kids Bedroom', 160, 'Changes Requested'], ['Living & Dining', 'Living Room', 380, 'Pending Approval'], ['Pooja Room', 'Pooja Room', 30, 'In Design'],
  ];
  for (const [name, roomType, areaSqft, designStatus] of rooms) {
    await Room.create({
      project: p1._id, name, roomType, areaSqft, designer: des._id, designStatus,
      approvedAt: designStatus === 'Approved' ? day(-30) : undefined,
      materials: [{ item: 'Plywood', specification: 'BWP 18mm', brand: 'Century', quantity: 8, unit: 'Sheet' }, { item: 'Laminate', specification: 'Matt finish – Frosty White', brand: 'Merino', quantity: 10, unit: 'Sheet' }],
      furniture: roomType === 'Kitchen' ? [{ name: 'Tall unit', specification: '600mm with pull-out', quantity: 1, cost: 38000 }, { name: 'Chimney', specification: '90cm auto-clean', quantity: 1, cost: 26000 }] : [{ name: 'Wardrobe', specification: 'Sliding, 3 door', quantity: 1, cost: 85000 }],
      revisions: designStatus === 'Changes Requested' ? [{ version: 1, notes: 'Change laminate to pastel blue; add study table.', requestedBy: 'Client', date: day(-3) }] : [],
      customWork: roomType === 'Living Room' ? 'Fluted panel feature wall with backlight' : '',
    });
  }

  /* ---------- Measurements, bills, payments ---------- */
  const mb1 = await Measurement.create({ project: p2._id, measurementType: 'Client', date: day(-20), measuredBy: se._id, status: 'Verified', items: [{ description: 'RCC – footings & columns', area: 'Foundation', unit: 'Cum', quantity: 48, rate: 13900 }, { description: 'Ground floor slab', area: 'GF', unit: 'Cum', quantity: 36, rate: 13900 }] });
  const mb2 = await Measurement.create({ project: p1._id, measurementType: 'Contractor', workOrder: wo1._id, subcontractor: subs[0]._id, date: day(-5), measuredBy: se._id, status: 'Verified', items: [{ description: 'Modular kitchen carcass', area: 'Kitchen', unit: 'Sqft', quantity: 66, rate: 350 }] });
  await Measurement.create({ project: p2._id, measurementType: 'Contractor', workOrder: wo3._id, subcontractor: subs[3]._id, date: day(-2), measuredBy: se._id, status: 'Draft', items: [{ description: 'Brick work 9"', area: 'First Floor', unit: 'Cum', nos: 1, length: 18, breadth: 0.23, height: 3, rate: 1300 }] });

  const billFromMb = async (mb, project, extra = {}) => {
    const isClient = mb.measurementType === 'Client';
    const b = await Bill.create({ billType: isClient ? 'Client' : 'Contractor', project: project._id, client: isClient ? project.client : undefined, subcontractor: mb.subcontractor, workOrder: mb.workOrder, measurement: mb._id, billDate: mb.date, dueDate: day(isClient ? -5 : 10), gstPercent: isClient ? 18 : 0, retentionPercent: isClient ? 0 : 5, items: mb.items.map((i) => ({ description: i.description, unit: i.unit, quantity: i.quantity, rate: i.rate })), ...extra });
    mb.status = 'Billed';
    mb.bill = b._id;
    await mb.save();
    return b;
  };
  const inv1 = await billFromMb(mb1, p2);
  const cb1 = await billFromMb(mb2, p1);

  // Advance / milestone invoices
  const adv = (project, pct, d, status) => Bill.create({ billType: 'Client', project: project._id, client: project.client, billDate: day(d), dueDate: day(d + 7), gstPercent: 0, items: [{ description: `${pct}% advance as per payment terms`, unit: 'LS', quantity: 1, rate: Math.round(project.contractValue * pct / 100) }], status });
  const inv2 = await adv(p1, 50, -40, 'Issued');
  const inv3 = await adv(p3, 40, -24, 'Issued');
  const inv4 = await adv(p2, 20, -85, 'Issued');
  const inv5 = await Bill.create({ billType: 'Client', project: p4._id, client: p4.client, billDate: day(-80), dueDate: day(-70), gstPercent: 0, items: [{ description: 'Final bill – painting works', unit: 'LS', quantity: 1, rate: 320000 }] });

  const pay = (bill, category, amount, d, mode = 'Bank Transfer') => Payment.create({ bill: bill._id, category, amount, date: day(d), mode, reference: 'UTR' + Math.floor(Math.random() * 1e8), recordedBy: acc._id });
  await pay(inv2, 'Client Advance', inv2.total, -38);
  await pay(inv3, 'Client Advance', Math.round(inv3.total * 0.6), -20);
  await pay(inv4, 'Client Advance', inv4.total, -84);
  await pay(inv1, 'Client Receipt', Math.round(inv1.total * 0.5), -8);
  await pay(inv5, 'Client Receipt', 320000, -72);
  await pay(cb1, 'Contractor Payment', 10000, -2, 'UPI');

  const pb1 = await Bill.create({ billType: 'Vendor', vendor: po1.vendor, project: p2._id, purchaseOrder: po1._id, partyInvoiceNo: 'SBC/2026/1182', billDate: day(-58), dueDate: day(-28), gstPercent: 18, items: po1.items.map((i) => ({ description: materials.find((m) => m._id.equals(i.material)).name, quantity: i.quantity, rate: i.rate, unit: materials.find((m) => m._id.equals(i.material)).unit })) });
  await pay(pb1, 'Vendor Payment', Math.round(pb1.total * 0.7), -30);
  const pb2 = await Bill.create({ billType: 'Vendor', vendor: po2.vendor, project: p1._id, purchaseOrder: po2._id, partyInvoiceNo: 'CPH-7781', billDate: day(-22), dueDate: day(8), gstPercent: 18, items: po2.items.map((i) => ({ description: materials.find((m) => m._id.equals(i.material)).name, quantity: i.quantity, rate: i.rate, unit: materials.find((m) => m._id.equals(i.material)).unit })) });
  await pay(pb2, 'Vendor Payment', 100000, -15);

  // Weekly wages settled from the muster (older days paid, last week still due) & expenses
  for (const w of await Attendance.distinct('worker', { project: p2._id, date: { $lt: day(-7) } })) {
    const rows = await Attendance.find({ project: p2._id, worker: w, date: { $lt: day(-7) }, wage: { $gt: 0 } });
    const amount = rows.reduce((s, a) => s + a.wage, 0);
    if (!amount) continue;
    const wp = await Payment.create({ category: 'Labour Wages', worker: w, amount, project: p2._id, date: day(-7), mode: 'Cash', notes: 'Weekly wages', recordedBy: acc._id });
    await Attendance.updateMany({ _id: { $in: rows.map((a) => a._id) } }, { payment: wp._id });
  }
  const exps = [
    [p2, 'Transport', 'Tipper lorry – sand & metal', 18500, -50], [p2, 'Equipment Rent', 'Concrete mixer & vibrator – 10 days', 22000, -36],
    [p1, 'Transport', 'Plywood delivery', 3500, -24], [p3, 'Site Expense', 'Debris removal', 6500, -10], [p1, 'Food & Accommodation', 'Carpenter team lunch', 2800, -3],
    [p2, 'Permits & Fees', 'Building plan approval fees', 45000, -88], [p3, 'Utilities', 'Temporary power connection', 8000, -24],
  ];
  for (const [project, category, description, amount, d] of exps) await Expense.create({ project: project._id, category, description, amount, date: day(d), paidTo: 'Various', mode: 'Cash', recordedBy: acc._id });

  /* ---------- CRM: follow-ups & after-sales service ---------- */
  const acts = [
    [leads[0], 'Email', 'Shared signed agreement copy', 'Project kick-off confirmed', -40],
    [leads[3], 'Call', 'Discussed kitchen & bathroom scope', 'Wants a granite counter option in the quote', -9],
    [leads[3], 'Meeting', 'Quotation walkthrough at site', 'Asked for 5% discount on bathroom fittings', -3, 1, 'Share revised quotation'],
    [leads[4], 'Site Visit', 'Measured the 2BHK', 'Prefers walnut laminate finish', -12],
    [leads[4], 'WhatsApp', 'Sent design references', 'Liked the pastel kitchen options', -1, 0, 'Confirm design concept'],
    [leads[5], 'Call', 'Intro call – G+3 commercial', 'Architect to share structural drawings', -5, -1, 'Collect drawings'],
  ];
  for (const [lead, type, subject, outcome, d, next, nextAction] of acts) {
    await Activity.updateMany({ lead: lead._id, status: 'Open' }, { status: 'Done' });
    await Activity.create({ lead: lead._id, client: lead.client, type, subject, outcome, date: day(d), nextFollowUp: next == null ? undefined : day(next), nextAction, by: lead.assignedTo });
  }
  const snag = await Task.create({ project: p1._id, title: 'TKT: Wardrobe shutter alignment', area: 'Master Bedroom', priority: 'High', dueDate: day(2), assignedTo: ss._id, status: 'In Progress', progress: 40 });
  await Ticket.create({ title: 'Wardrobe shutter alignment', client: p1.client, project: p1._id, category: 'Snag / Rework', priority: 'High', location: 'Master Bedroom', description: 'Left shutter rubs the frame while closing', status: 'In Progress', assignedTo: ss._id, raisedBy: pm._id, dueDate: day(2), task: snag._id });
  await Ticket.create({ title: 'Paint peeling near balcony door', client: p4.client, project: p4._id, category: 'Warranty', priority: 'Medium', location: 'Balcony', description: 'Paint flaking after the rains', status: 'Open', assignedTo: se._id, raisedBy: pm._id, dueDate: day(5) });
  await Ticket.create({ title: 'Touch-up in living room ceiling', client: p4.client, project: p4._id, category: 'Snag / Rework', priority: 'Low', location: 'Living room', status: 'Resolved', resolution: 'Touch-up done and approved by client', raisedBy: pm._id });

  /* ---------- HR: employees, staff attendance, leave, advance, payroll ---------- */
  const SALARY = {
    'Super Admin': [90000, 'Management'], Admin: [60000, 'Management'], 'Project Manager': [55000, 'Projects'],
    'Site Engineer': [28000, 'Site Execution'], 'Site Supervisor': [18000, 'Site Execution'], Estimator: [32000, 'Estimation'],
    'Purchase Manager': [35000, 'Purchase'], Accountant: [30000, 'Accounts'], Designer: [38000, 'Design'],
    'Store Manager': [20000, 'Stores'], 'HR Manager': [34000, 'HR & Admin'],
  };
  const emps = {};
  for (const [i, u] of (await User.find({ role: { $in: Object.keys(SALARY) } }).sort('createdAt')).entries()) {
    const [gross, department] = SALARY[u.role];
    const basic = Math.round(gross * 0.5);
    const hra = Math.round(gross * 0.2);
    emps[u.role] = await Employee.create({
      name: u.name, phone: u.phone, email: u.email, user: u._id, department, designation: u.designation, joiningDate: day(-420 + i * 25),
      basic, hra, allowances: gross - basic - hra, esiApplicable: gross <= 21000, pan: 'AAAPL' + (1200 + i * 37) + 'K', uan: '1009' + (55000000 + i * 1373),
      bankName: 'HDFC Bank', bankAccount: '5010' + (2000000 + i * 7311), ifsc: 'HDFC0001234',
    });
  }
  const reportsTo = {
    'Site Engineer': 'Project Manager', 'Site Supervisor': 'Project Manager', Designer: 'Project Manager', Estimator: 'Project Manager',
    'Project Manager': 'Admin', 'Purchase Manager': 'Admin', Accountant: 'Admin', 'Store Manager': 'Admin', 'HR Manager': 'Admin', Admin: 'Super Admin',
  };
  for (const [role, mgr] of Object.entries(reportsTo)) await Employee.updateOne({ _id: emps[role]._id }, { reportingTo: emps[mgr]._id });

  // Muster from the 1st of last month to yesterday (Sundays off, a few absences / half days)
  const lastMonth = new Date(Date.UTC(day(0).getUTCFullYear(), day(0).getUTCMonth() - 1, 1));
  const marks = [];
  for (let d = new Date(lastMonth); d < day(0); d = new Date(+d + 864e5)) {
    for (const [i, e] of Object.values(emps).entries()) {
      const off = d.getUTCDay() === 0;
      const r = (d.getUTCDate() * 7 + i * 3) % 23;
      marks.push({ date: d, employee: e._id, status: off ? 'Week Off' : r === 0 ? 'Absent' : r === 5 ? 'Half Day' : 'Present', checkIn: off ? undefined : `09:${10 + i}`, checkOut: off ? undefined : `18:${20 + i}`, markedBy: hr._id });
    }
  }
  await StaffAttendance.insertMany(marks);

  const lm = (n) => new Date(+lastMonth + (n - 1) * 864e5);
  const applyLeave = async (role, leaveType, from, to, status, reason) => {
    const l = await Leave.create({ employee: emps[role]._id, leaveType, from, to, status, reason, ...(status === 'Approved' ? { approvedBy: hr._id, approvedAt: from } : {}) });
    if (status !== 'Approved') return;
    for (let d = new Date(l.from); d <= l.to; d = new Date(+d + 864e5)) {
      await StaffAttendance.findOneAndUpdate({ date: d, employee: l.employee }, { status: 'Leave', leave: l._id, markedBy: hr._id }, { upsert: true });
    }
  };
  await applyLeave('Site Engineer', 'Casual Leave', lm(10), lm(11), 'Approved', 'Family function');
  await applyLeave('Site Supervisor', 'Loss of Pay', lm(18), lm(18), 'Approved', 'Personal work');
  await applyLeave('Designer', 'Sick Leave', day(4), day(5), 'Pending', 'Medical appointment');
  await applyLeave('Estimator', 'Earned Leave', day(10), day(14), 'Pending', 'Family vacation');

  const advance = await Advance.create({ employee: emps['Site Supervisor']._id, date: day(-50), amount: 12000, installment: 3000, mode: 'Cash', reason: 'Medical expense' });
  advance.payment = (await Payment.create({ category: 'Salary Advance', employee: advance.employee, amount: advance.amount, date: advance.date, mode: 'Cash', notes: `Salary advance ${advance.code}`, recordedBy: acc._id }))._id;
  await advance.save();

  // Last month's payroll: run → approve → pay on the 1st (salary payments + advance recovery)
  const month = lastMonth.toISOString().slice(0, 7);
  const payDay = new Date(Date.UTC(day(0).getUTCFullYear(), day(0).getUTCMonth(), 1));
  const payroll = await Payroll.create({ month, lines: await buildPayrollLines(month), status: 'Approved', approvedBy: hr._id, approvedAt: payDay });
  for (const l of payroll.lines) {
    l.payment = (await Payment.create({ category: 'Salary', employee: l.employee, amount: l.net, date: payDay, mode: 'Bank Transfer', notes: `Salary ${month} (${payroll.code})`, recordedBy: acc._id }))._id;
  }
  payroll.set({ status: 'Paid', paidAt: payDay });
  await payroll.save();
  await recoverAdvances(payroll);

  console.log('\n✔ Seed complete. Login with any of these (password: password123):');
  for (const u of await User.find().sort('createdAt')) console.log(`   ${u.role.padEnd(18)} ${u.email}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
