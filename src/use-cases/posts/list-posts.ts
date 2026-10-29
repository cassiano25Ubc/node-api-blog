import type { LikesRepository } from '../../repositories/likes.repository.js';
import type { PostsRepository } from '../../repositories/posts.repository.js';
import type { RepliesRepository } from '../../repositories/replies.repository.js';

const PAGE_LIMIT = 10;

type ListPostsInput = {
    page: number;
}

export class ListPostsUseCase {
    constructor(
        private readonly postsRepository: PostsRepository,
        private readonly likesRepository: LikesRepository,
        private readonly repliesRepository: RepliesRepository,
    ) { }

    async execute({ page }: ListPostsInput) {
        const { rows, total } = await this.postsRepository.listWithAuthor(page, PAGE_LIMIT);
        const postIds = rows.map((row) => row.id);
        const [likesCounts, replies] = await Promise.all([
            this.likesRepository.countByPostIds(postIds),
            this.repliesRepository.listByPostIds(postIds),
        ]);
        const repliesByPostId = new Map<number, typeof replies>();

        for (const reply of replies) {
            const postReplies = repliesByPostId.get(reply.postId) ?? [];
            postReplies.push(reply);
            repliesByPostId.set(reply.postId, postReplies);
        }

        return {
            rows: rows.map((row) => ({
                ...row,
                likesCount: likesCounts.get(row.id) ?? 0,
                replies: repliesByPostId.get(row.id) ?? [],
            })),
            total,
            page,
            limit: PAGE_LIMIT,
        };
    }
}
