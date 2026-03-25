import { PrismaService } from '../../common/prisma/prisma.service';
import { UsersService } from './users.service';
import { Test } from '@nestjs/testing';
import { RedisService } from '../../common/redis/redis.service';


describe('UsersService', () => {
    let service: UsersService;
    let prisma: PrismaService;

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: PrismaService,
                    useValue: {
                        user: {
                            findMany: jest.fn(),
                            count: jest.fn(),
                        },
                    },
                },
                {
                    provide: RedisService,
                    useValue: {},
                },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    it('should return paginated users', async () => {
        (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: '1', email: 'a@test.com' }]);
        (prisma.user.count as jest.Mock).mockResolvedValue(1);

        const result = await service.findAll({ page: 1, limit: 10 });
        expect(result.data.length).toBe(1);
        expect(result.meta.total).toBe(1);
    });
});