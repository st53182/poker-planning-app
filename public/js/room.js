class PlanningPokerRoom {
    constructor() {
        this.socket = io();
        this.roomData = {};
        this.participant = {};
        this.participants = [];
        this.stories = [];
        this.currentStory = null;
        this.selectedVote = null;
        this.isAdmin = false;
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
        this.joinRoom();
    }

    initializeEventListeners() {
        document.getElementById('copyLinkBtn').addEventListener('click', () => {
            const baseUrl = window.location.origin + window.location.pathname;
            navigator.clipboard.writeText(baseUrl).then(() => {
                this.showToast('Ссылка на комнату скопирована!', 'success');
            }).catch(() => {
                this.showToast(`Поделитесь этой ссылкой: ${baseUrl}`, 'info');
            });
        });

        document.getElementById('createStoryBtn').addEventListener('click', () => {
            this.createStory();
        });

        document.getElementById('startVotingBtn').addEventListener('click', () => {
            this.startVoting();
        });

        document.getElementById('revealVotesBtn').addEventListener('click', () => {
            this.revealVotes();
        });

        document.getElementById('finalizeBtn').addEventListener('click', () => {
            this.finalizeEstimate();
        });

        document.getElementById('voteAgainBtn').addEventListener('click', () => {
            this.startVoting();
        });

        document.getElementById('submitVoteBtn').addEventListener('click', () => {
            this.submitVote();
        });

        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            this.joinRoom();
        });

        document.getElementById('dismissError').addEventListener('click', () => {
            document.getElementById('errorToast').classList.add('hidden');
        });

        document.getElementById('newStoryTitle').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createStory();
        });
    }

    initializeSocketListeners() {
        this.socket.on('room_joined', (data) => {
            this.handleRoomJoined(data);
        });

        this.socket.on('participant_joined', (data) => {
            this.participants.push(data.participant);
            this.updateParticipantsList();
        });

        this.socket.on('story_created', (data) => {
            this.stories.unshift(data.story);
            this.updateStoriesList();
        });

        this.socket.on('current_story_set', (data) => {
            this.currentStory = data.story;
            this.updateCurrentStory();
            this.resetVotingState();
        });

        this.socket.on('voting_started', (data) => {
            if (this.currentStory && this.currentStory.id === data.story_id) {
                this.currentStory.voting_state = 'voting';
                this.updateVotingState();
                this.resetVotingState();
            }
        });

        this.socket.on('vote_submitted', (data) => {
            document.getElementById('voteCount').textContent = data.vote_count;
            document.getElementById('participantCount').textContent = data.participant_count;
        });

        this.socket.on('votes_revealed', (data) => {
            if (this.currentStory && this.currentStory.id === data.story_id) {
                this.currentStory.voting_state = 'revealed';
                this.updateVotingState();
                this.displayRevealedVotes(data.votes);
            }
        });

        this.socket.on('estimate_finalized', (data) => {
            if (this.currentStory && this.currentStory.id === data.story_id) {
                this.currentStory.voting_state = 'completed';
                this.currentStory.final_estimate = data.final_estimate;
                this.updateVotingState();
                this.updateStoriesList();
            }
        });

        this.socket.on('similar_stories', (data) => {
            this.displaySimilarStories(data.stories);
        });

        this.socket.on('admin_promoted', (data) => {
            const participantIndex = this.participants.findIndex(p => p.id === data.participant.id);
            if (participantIndex !== -1) {
                this.participants[participantIndex] = data.participant;
                this.updateParticipantsList();
            }
        });

        this.socket.on('error', (data) => {
            this.showError(data.message);
        });
    }

    joinRoom() {
        const urlParams = new URLSearchParams(window.location.search);
        const pathParts = window.location.pathname.split('/');
        const encryptedLink = pathParts[pathParts.length - 1];
        
        let name = urlParams.get('name');
        let competence = urlParams.get('competence');
        
        const isCreator = localStorage.getItem('session_id') && urlParams.has('name') && urlParams.has('competence');
        
        if (!isCreator || !name || !competence) {
            document.getElementById('joinName').value = '';
            document.getElementById('joinCompetence').value = 'Frontend';
            document.getElementById('joinModal').classList.remove('hidden');
            
            document.getElementById('joinRoomBtn').onclick = () => {
                name = document.getElementById('joinName').value.trim();
                competence = document.getElementById('joinCompetence').value;
                
                if (!name) {
                    this.showError('Пожалуйста, введите ваше имя');
                    return;
                }
                
                document.getElementById('joinModal').classList.add('hidden');
                this.performJoin(encryptedLink, name, competence);
            };
        } else {
            document.getElementById('joinModal').classList.add('hidden');
            this.performJoin(encryptedLink, name, competence);
        }
    }

    performJoin(encryptedLink, name, competence) {
        const sessionId = localStorage.getItem('session_id') || this.generateSessionId();
        
        this.socket.emit('join_room_by_link', {
            encrypted_link: encryptedLink,
            name: name,
            competence: competence,
            session_id: sessionId
        });
    }

    generateSessionId() {
        const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('session_id', sessionId);
        return sessionId;
    }

    handleRoomJoined(data) {
        this.roomData = data;
        this.participant = data.participant;
        this.participants = data.participants;
        this.stories = data.stories;
        this.currentStory = data.current_story;
        this.isAdmin = data.participant.is_admin;

        document.getElementById('roomName').textContent = data.room_name || 'Комната Планирования';
        document.getElementById('estimationType').textContent = `Тип оценки: ${data.estimation_type === 'story_points' ? 'Стори поинты' : 'Часы'}`;
        document.getElementById('userName').textContent = data.participant.name;
        document.getElementById('userCompetence').textContent = data.participant.competence;
        
        if (this.isAdmin) {
            document.getElementById('adminBadge').classList.remove('hidden');
            document.getElementById('adminControls').classList.remove('hidden');
        }

        this.updateParticipantsList();
        this.updateStoriesList();
        this.updateCurrentStory();
        this.generateVotingCards();
    }

    generateVotingCards() {
        const votingCards = document.getElementById('votingCards');
        const values = this.roomData.estimation_type === 'story_points' 
            ? [0.5, 1, 2, 3, 5, 8, 13, 21, 34]
            : [1, 2, 4, 8, 16, 24, 32, 40, 48, 56, 64];

        votingCards.innerHTML = '';
        
        values.forEach(value => {
            const card = document.createElement('div');
            card.className = 'voting-card bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors';
            card.innerHTML = `<div class="text-lg font-bold">${value}</div>`;
            
            card.addEventListener('click', () => {
                this.selectVote(value);
            });
            
            votingCards.appendChild(card);
        });
    }

    selectVote(value) {
        this.selectedVote = value;
        
        document.querySelectorAll('.voting-card').forEach(card => {
            card.classList.remove('selected', 'border-blue-500', 'bg-blue-50');
            card.classList.add('border-gray-200');
        });
        
        event.target.closest('.voting-card').classList.add('selected', 'border-blue-500', 'bg-blue-50');
        event.target.closest('.voting-card').classList.remove('border-gray-200');
        
        document.getElementById('selectedVoteValue').textContent = value;
        document.getElementById('submitVoteBtn').classList.remove('hidden');
        
        this.socket.emit('get_similar_stories', {
            room_id: this.roomData.room_id,
            vote_value: value,
            competence: this.participant.competence
        });
    }

    createStory() {
        const title = document.getElementById('newStoryTitle').value.trim();
        const description = document.getElementById('newStoryDescription').value.trim();
        
        if (!title) {
            this.showError('Пожалуйста, введите название истории');
            return;
        }
        
        this.socket.emit('create_story', {
            room_id: this.roomData.room_id,
            title: title,
            description: description,
            participant_id: this.participant.id
        });
        
        document.getElementById('newStoryTitle').value = '';
        document.getElementById('newStoryDescription').value = '';
    }

    setCurrentStory(storyId) {
        if (!this.isAdmin) return;
        
        this.socket.emit('set_current_story', {
            room_id: this.roomData.room_id,
            story_id: storyId,
            participant_id: this.participant.id
        });
    }

    startVoting() {
        this.socket.emit('start_voting', {
            room_id: this.roomData.room_id,
            story_id: this.currentStory.id,
            participant_id: this.participant.id
        });
    }

    submitVote() {
        if (this.selectedVote === null) return;
        
        this.socket.emit('submit_vote', {
            room_id: this.roomData.room_id,
            story_id: this.currentStory.id,
            points: this.selectedVote,
            participant_id: this.participant.id
        });
        
        document.getElementById('submitVoteBtn').classList.add('hidden');
        this.showToast('Голос отправлен!', 'success');
    }

    revealVotes() {
        this.socket.emit('reveal_votes', {
            room_id: this.roomData.room_id,
            story_id: this.currentStory.id,
            participant_id: this.participant.id
        });
    }

    finalizeEstimate() {
        const finalEstimate = parseFloat(document.getElementById('finalEstimateInput').value);
        
        if (!finalEstimate) {
            this.showError('Пожалуйста, введите финальную оценку');
            return;
        }
        
        this.socket.emit('finalize_estimate', {
            room_id: this.roomData.room_id,
            story_id: this.currentStory.id,
            final_estimate: finalEstimate,
            participant_id: this.participant.id
        });
        
        document.getElementById('finalEstimateInput').value = '';
    }

    makeAdmin(participantId) {
        this.socket.emit('make_admin', {
            room_id: this.roomData.room_id,
            target_participant_id: participantId,
            participant_id: this.participant.id
        });
    }

    updateCurrentStory() {
        const section = document.getElementById('currentStorySection');
        
        if (!this.currentStory) {
            section.classList.add('hidden');
            return;
        }
        
        section.classList.remove('hidden');
        document.getElementById('currentStoryTitle').textContent = this.currentStory.title;
        
        const descElement = document.getElementById('currentStoryDescription');
        if (this.currentStory.description) {
            descElement.textContent = this.currentStory.description;
            descElement.classList.remove('hidden');
        } else {
            descElement.classList.add('hidden');
        }
        
        this.updateVotingState();
    }

    updateVotingState() {
        if (!this.currentStory) return;
        
        const state = this.currentStory.voting_state;
        const badge = document.getElementById('votingStateBadge');
        const votingSection = document.getElementById('votingSection');
        const revealedSection = document.getElementById('revealedVotesSection');
        const startBtn = document.getElementById('startVotingBtn');
        const revealBtn = document.getElementById('revealVotesBtn');
        const finalizeControls = document.getElementById('finalizeControls');
        
        const stateLabels = {
            'not_started': 'Не начато',
            'voting': 'Голосование',
            'revealed': 'Показано',
            'completed': 'Завершено'
        };
        
        const stateClasses = {
            'not_started': 'bg-gray-100 text-gray-800',
            'voting': 'bg-blue-100 text-blue-800',
            'revealed': 'bg-green-100 text-green-800',
            'completed': 'bg-purple-100 text-purple-800'
        };
        
        badge.textContent = stateLabels[state] || state;
        badge.className = `px-3 py-1 rounded-full text-sm font-medium ${stateClasses[state]}`;
        
        if (this.isAdmin) {
            startBtn.classList.toggle('hidden', state !== 'not_started');
            revealBtn.classList.toggle('hidden', state !== 'voting');
            finalizeControls.classList.toggle('hidden', state !== 'revealed');
        }
        
        votingSection.classList.toggle('hidden', state !== 'voting');
        revealedSection.classList.toggle('hidden', state !== 'revealed');
    }

    resetVotingState() {
        this.selectedVote = null;
        document.getElementById('submitVoteBtn').classList.add('hidden');
        document.getElementById('similarStoriesSection').classList.add('hidden');
        
        document.querySelectorAll('.voting-card').forEach(card => {
            card.classList.remove('selected', 'border-blue-500', 'bg-blue-50');
            card.classList.add('border-gray-200');
        });
    }

    displayRevealedVotes(votes) {
        const container = document.getElementById('revealedVotes');
        container.innerHTML = '';
        
        votes.forEach(vote => {
            const voteElement = document.createElement('div');
            voteElement.className = 'bg-green-50 border border-green-200 rounded-lg p-4 text-center';
            voteElement.innerHTML = `
                <div class="text-lg font-bold">${vote.points}</div>
                <div class="text-sm text-gray-600">${vote.participant_name}</div>
                <div class="text-xs text-gray-500">${vote.competence}</div>
            `;
            container.appendChild(voteElement);
        });
    }

    displaySimilarStories(stories) {
        const section = document.getElementById('similarStoriesSection');
        const list = document.getElementById('similarStoriesList');
        const valueSpan = document.getElementById('similarVoteValue');
        const typeSpan = document.getElementById('similarEstimationType');
        
        if (stories.length === 0) {
            section.classList.add('hidden');
            return;
        }
        
        valueSpan.textContent = this.selectedVote;
        typeSpan.textContent = this.roomData.estimation_type === 'story_points' ? 'поинтов' : 'часов';
        
        list.innerHTML = '';
        stories.slice(0, 5).forEach(story => {
            const storyElement = document.createElement('div');
            storyElement.className = 'text-sm text-blue-800';
            storyElement.textContent = `"${story.title}" - ${story.points} ${this.roomData.estimation_type === 'story_points' ? 'поинтов' : 'часов'}`;
            list.appendChild(storyElement);
        });
        
        section.classList.remove('hidden');
    }

    updateParticipantsList() {
        const container = document.getElementById('participantsList');
        const count = document.getElementById('participantsCount');
        
        count.textContent = this.participants.length;
        
        if (this.participants.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Пока нет участников.</p>';
            return;
        }
        
        container.innerHTML = '';
        
        this.participants.forEach(participant => {
            const participantElement = document.createElement('div');
            participantElement.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
            
            const adminBadge = participant.is_admin 
                ? '<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Админ</span>'
                : '';
            
            const makeAdminBtn = this.isAdmin && !participant.is_admin && participant.id !== this.participant.id
                ? `<button onclick="room.makeAdmin('${participant.id}')" class="text-xs text-blue-600 hover:text-blue-800">Сделать админом</button>`
                : '';
            
            participantElement.innerHTML = `
                <div>
                    <div class="font-medium text-gray-900">${participant.name}</div>
                    <div class="text-sm text-gray-600">${participant.competence}</div>
                </div>
                <div class="flex items-center space-x-2">
                    ${adminBadge}
                    ${makeAdminBtn}
                </div>
            `;
            
            container.appendChild(participantElement);
        });
    }

    updateStoriesList() {
        const container = document.getElementById('storiesList');
        
        if (this.stories.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Пока нет историй. Добавьте первую историю выше!</p>';
            return;
        }
        
        container.innerHTML = '';
        
        this.stories.forEach(story => {
            const storyElement = document.createElement('div');
            const isCurrentStory = this.currentStory && story.id === this.currentStory.id;
            
            storyElement.className = `p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                isCurrentStory ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`;
            
            if (this.isAdmin) {
                storyElement.addEventListener('click', () => this.setCurrentStory(story.id));
            }
            
            const finalEstimateBadge = story.final_estimate 
                ? `<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">${story.final_estimate} ${this.roomData.estimation_type === 'story_points' ? 'поинтов' : 'часов'}</span>`
                : '';
            
            const stateClasses = {
                'not_started': 'bg-gray-100 text-gray-800',
                'voting': 'bg-blue-100 text-blue-800',
                'revealed': 'bg-green-100 text-green-800',
                'completed': 'bg-purple-100 text-purple-800'
            };
            
            const stateLabels = {
                'not_started': 'Не начато',
                'voting': 'Голосование',
                'revealed': 'Показано',
                'completed': 'Завершено'
            };
            
            storyElement.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-medium text-gray-900">${story.title}</h4>
                        ${story.description ? `<p class="text-sm text-gray-600 mt-1">${story.description}</p>` : ''}
                    </div>
                    <div class="flex items-center space-x-2">
                        ${finalEstimateBadge}
                        <span class="px-2 py-1 rounded text-xs ${stateClasses[story.voting_state] || 'bg-gray-100 text-gray-800'}">
                            ${stateLabels[story.voting_state] || story.voting_state}
                        </span>
                    </div>
                </div>
            `;
            
            container.appendChild(storyElement);
        });
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorToast').classList.remove('hidden');
        
        setTimeout(() => {
            document.getElementById('errorToast').classList.add('hidden');
        }, 5000);
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 left-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
            type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
            'bg-blue-50 border border-blue-200 text-blue-800'
        }`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

let room;
document.addEventListener('DOMContentLoaded', () => {
    room = new PlanningPokerRoom();
});
